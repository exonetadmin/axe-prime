import '@/src/server/server-only';

import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { queryOne, withTransaction } from '@/src/server/db/postgres';
import { maybePruneExpiredAuthRecords } from '@/src/server/security/auth-record-cleanup';
import {
  createRefreshToken,
  hashLegacyOpaqueToken,
  hashOpaqueToken,
  PASSWORD_RESET_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@/src/server/security/tokens';

const MAX_PASSWORD_RESET_CONFIRMATION_ATTEMPTS = 5;
const PASSWORD_RESET_HASH_LENGTH = 64;

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isPasswordResetCodeHashMatch(stored: string, expected: string): boolean {
  if (!stored || !expected) return false;
  if (
    stored.length !== PASSWORD_RESET_HASH_LENGTH ||
    expected.length !== PASSWORD_RESET_HASH_LENGTH ||
    !/^[0-9a-fA-F]{64}$/.test(stored) ||
    !/^[0-9a-f]{64}$/.test(expected)
  ) {
    return false;
  }
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(expected, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type SessionContext = {
  userAgentHash?: string | null;
  ipAddress?: string | null;
};

export type SessionCredentials = {
  sessionId: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  userId: string;
  tokenVersion: number;
};

export type RefreshRotationResult =
  | { status: 'ok'; credentials: SessionCredentials }
  | { status: 'invalid' | 'replayed' | 'already_rotated' };

const REFRESH_REUSE_GRACE_MILLISECONDS = 10_000;

type RefreshTokenRow = {
  id: string;
  session_id: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  revoked_at: Date | string | null;
};

type SessionRow = {
  id: string;
  user_id: string | null;
  token_version: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  database_now: Date | string;
};

type UserStateRow = {
  id: string;
  token_version: number;
  is_active: boolean;
};

function tokenHashes(token: string): string[] {
  return [hashOpaqueToken(token), hashLegacyOpaqueToken(token)];
}

async function revokeSessionInTransaction(
  client: PoolClient,
  sessionId: string,
  reason: string
): Promise<void> {
  await client.query(
    `UPDATE public.auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoke_reason = COALESCE(revoke_reason, $2)
      WHERE id = $1`,
    [sessionId, reason]
  );
  await client.query(
    `UPDATE public.auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE session_id = $1
        AND revoked_at IS NULL`,
    [sessionId]
  );
}

export class SessionRepository {
  async createUserSession(
    userId: string,
    tokenVersion: number,
    context: SessionContext = {}
  ): Promise<SessionCredentials> {
    await maybePruneExpiredAuthRecords();
    const sessionId = randomUUID();
    const refreshTokenId = randomUUID();
    const refreshToken = createRefreshToken();

    const expiresAt = await withTransaction(async client => {
      const sessionResult = await client.query<{ expires_at: Date | string }>(
        `INSERT INTO public.auth_sessions (
           id, user_id, token_version, expires_at, user_agent_hash, ip_address
         ) VALUES (
           $1, $2, $3,
           NOW() + ($4::integer * INTERVAL '1 second'),
           $5, $6
         )
         RETURNING expires_at`,
        [
          sessionId,
          userId,
          tokenVersion,
          REFRESH_TOKEN_TTL_SECONDS,
          context.userAgentHash ?? null,
          context.ipAddress ?? null,
        ]
      );
      const databaseExpiry = sessionResult.rows[0]?.expires_at;
      if (!databaseExpiry) throw new Error('Session expiry was not returned');
      await client.query(
        `INSERT INTO public.auth_refresh_tokens (
           id, session_id, token_hash, expires_at
         ) VALUES ($1, $2, $3, $4)`,
        [refreshTokenId, sessionId, hashOpaqueToken(refreshToken), databaseExpiry]
      );
      return new Date(databaseExpiry);
    });

    const credentials = {
      sessionId,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
      userId,
      tokenVersion,
    };
    return credentials;
  }

  async validateAccessSession(
    sessionId: string,
    userId: string,
    tokenVersion: number
  ): Promise<boolean> {
    const row = await queryOne<{ valid: boolean }>(
      `SELECT TRUE AS valid
         FROM public.auth_sessions s
         JOIN public.users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.user_id = $2
          AND s.token_version = $3
          AND u.token_version = $3
          AND u.is_active = TRUE
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()`,
      [sessionId, userId, tokenVersion]
    );
    return row?.valid === true;
  }

  /** Read-only BFF session validation for Server Components after access expiry. */
  async validateRefreshSession(
    refreshToken: string
  ): Promise<{ sessionId: string; userId: string; tokenVersion: number } | null> {
    const row = await queryOne<{
      session_id: string;
      user_id: string;
      token_version: number;
    }>(
      `SELECT s.id AS session_id, s.user_id, s.token_version
         FROM public.auth_refresh_tokens rt
         JOIN public.auth_sessions s ON s.id = rt.session_id
         JOIN public.users u ON u.id = s.user_id
        WHERE rt.token_hash = ANY($1::varchar[])
          AND rt.consumed_at IS NULL
          AND rt.revoked_at IS NULL
          AND rt.expires_at > NOW()
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND s.token_version = u.token_version
          AND u.is_active = TRUE
        LIMIT 1`,
      [tokenHashes(refreshToken)]
    );
    if (!row?.user_id) return null;
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      tokenVersion: row.token_version,
    };
  }

  async rotateRefreshToken(refreshToken: string): Promise<RefreshRotationResult> {
    await maybePruneExpiredAuthRecords();
    return withTransaction<RefreshRotationResult>(async client => {
      // Resolve first, then always lock user -> session -> token. The same
      // global order is used by password/account state changes.
      const ownerResult = await client.query<{
        session_id: string;
        user_id: string;
      }>(
        `SELECT rt.session_id, s.user_id
           FROM public.auth_refresh_tokens rt
           JOIN public.auth_sessions s ON s.id = rt.session_id
          WHERE rt.token_hash = ANY($1::varchar[])
          LIMIT 1`,
        [tokenHashes(refreshToken)]
      );
      const owner = ownerResult.rows[0];
      if (!owner?.session_id || !owner.user_id) return { status: 'invalid' };

      // All identity-changing transactions use user -> session -> token.
      const userResult = await client.query<UserStateRow>(
        `SELECT id, token_version, is_active
           FROM public.users
          WHERE id = $1
          FOR UPDATE`,
        [owner.user_id]
      );
      const user = userResult.rows[0];
      if (!user) return { status: 'invalid' };

      const sessionResult = await client.query<SessionRow>(
        `SELECT id, user_id, token_version, expires_at, revoked_at,
                clock_timestamp() AS database_now
           FROM public.auth_sessions
          WHERE id = $1
          FOR UPDATE`,
        [owner.session_id]
      );
      const session = sessionResult.rows[0];
      if (!session?.user_id) return { status: 'invalid' };

      const tokenResult = await client.query<RefreshTokenRow>(
        `SELECT id, session_id, expires_at, consumed_at, revoked_at
           FROM public.auth_refresh_tokens
          WHERE token_hash = ANY($1::varchar[])
            AND session_id = $2
          LIMIT 1
          FOR UPDATE`,
        [tokenHashes(refreshToken), session.id]
      );
      const currentToken = tokenResult.rows[0];
      if (!currentToken) return { status: 'invalid' };

      const databaseNow = new Date(session.database_now);
      const tokenExpiresAt = new Date(currentToken.expires_at);
      const sessionExpiresAt = new Date(session.expires_at);

      if (currentToken.consumed_at) {
        const consumedAt = new Date(currentToken.consumed_at);
        if (databaseNow.getTime() - consumedAt.getTime() <= REFRESH_REUSE_GRACE_MILLISECONDS) {
          return { status: 'already_rotated' };
        }
        await revokeSessionInTransaction(client, session.id, 'refresh_token_replay');
        return { status: 'replayed' };
      }

      if (
        currentToken.revoked_at ||
        tokenExpiresAt.getTime() <= databaseNow.getTime() ||
        session.revoked_at ||
        sessionExpiresAt.getTime() <= databaseNow.getTime()
      ) {
        await revokeSessionInTransaction(client, session.id, 'session_expired');
        return { status: 'invalid' };
      }

      if (
        session.user_id !== user.id ||
        !user.is_active ||
        user.token_version !== session.token_version
      ) {
        await revokeSessionInTransaction(client, session.id, 'identity_changed');
        return { status: 'invalid' };
      }

      const nextToken = createRefreshToken();
      const nextTokenId = randomUUID();
      const nextExpiry = new Date(
        Math.min(
          sessionExpiresAt.getTime(),
          databaseNow.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000
        )
      );

      // Consume first so the partial unique index permits one new active token.
      await client.query(
        `UPDATE public.auth_refresh_tokens
            SET consumed_at = NOW()
          WHERE id = $1`,
        [currentToken.id]
      );
      await client.query(
        `INSERT INTO public.auth_refresh_tokens (
           id, session_id, token_hash, expires_at
         ) VALUES ($1, $2, $3, $4)`,
        [nextTokenId, session.id, hashOpaqueToken(nextToken), nextExpiry]
      );
      await client.query(
        `UPDATE public.auth_refresh_tokens
            SET replaced_by_token_id = $2
          WHERE id = $1`,
        [currentToken.id, nextTokenId]
      );
      await client.query(
        `UPDATE public.auth_sessions
            SET last_seen_at = NOW()
          WHERE id = $1`,
        [session.id]
      );

      return {
        status: 'ok',
        credentials: {
          sessionId: session.id,
          refreshToken: nextToken,
          refreshTokenExpiresAt: nextExpiry,
          userId: user.id,
          tokenVersion: user.token_version,
        },
      };
    });
  }

  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    await withTransaction(client => revokeSessionInTransaction(client, sessionId, reason));
  }

  async revokeByRefreshToken(refreshToken: string, reason = 'logout'): Promise<void> {
    await withTransaction(async client => {
      const result = await client.query<{ session_id: string }>(
        `SELECT session_id
           FROM public.auth_refresh_tokens
          WHERE token_hash = ANY($1::varchar[])
          LIMIT 1`,
        [tokenHashes(refreshToken)]
      );
      const sessionId = result.rows[0]?.session_id;
      if (sessionId) {
        await client.query('SELECT id FROM public.auth_sessions WHERE id = $1 FOR UPDATE', [
          sessionId,
        ]);
        await revokeSessionInTransaction(client, sessionId, reason);
      }
    });
  }

  async createPasswordResetToken(
    userId: string,
    confirmationCodeHash: string,
    confirmationCodeExpiresAt: Date
  ): Promise<string> {
    await maybePruneExpiredAuthRecords();
    const token = createRefreshToken();
    const tokenHash = hashOpaqueToken(token);
    await withTransaction(async client => {
      const userResult = await client.query<{ id: string }>(
        'SELECT id FROM public.users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (!userResult.rows[0]) throw new Error('Reset user could not be locked');
      await client.query(
        `UPDATE public.password_reset_tokens
            SET consumed_at = COALESCE(consumed_at, NOW())
          WHERE user_id = $1
            AND consumed_at IS NULL`,
        [userId]
      );
      await client.query(
        `INSERT INTO public.password_reset_tokens (
           id, user_id, token_hash, expires_at,
           email_confirmation_code_hash, email_confirmation_code_expires_at,
           email_confirmation_attempts
         ) VALUES (
           $1, $2, $3,
           NOW() + ($4::integer * INTERVAL '1 second'),
           $5, $6, $7
         )`,
        [
          randomUUID(),
          userId,
          tokenHash,
          PASSWORD_RESET_TTL_SECONDS,
          confirmationCodeHash,
          confirmationCodeExpiresAt,
          0,
        ]
      );
    });
    return token;
  }

  async findRefreshSessionId(refreshToken: string): Promise<string | null> {
    const row = await queryOne<{ session_id: string }>(
      `SELECT session_id
         FROM public.auth_refresh_tokens
        WHERE token_hash = ANY($1::varchar[])
        LIMIT 1`,
      [tokenHashes(refreshToken)]
    );
    return row?.session_id ?? null;
  }

  async invalidatePasswordResetToken(token: string): Promise<void> {
    await withTransaction(async client => {
      await client.query(
        `UPDATE public.password_reset_tokens
            SET consumed_at = COALESCE(consumed_at, NOW())
          WHERE token_hash = ANY($1::varchar[])
            AND consumed_at IS NULL`,
        [tokenHashes(token)]
      );
    });
  }

  async consumePasswordResetToken(
    token: string,
    expectedEmail: string,
    expectedCodeHash: string,
    passwordHash: string
  ): Promise<string | null> {
    const expectedEmailHash = normalizeEmail(expectedEmail);
    const expectedCodeHashNormalized = expectedCodeHash.trim().toLowerCase();
    if (!expectedEmailHash || !expectedCodeHashNormalized) return null;

    return withTransaction(async client => {
      const ownerResult = await client.query<{ user_id: string; email: string }>(
        `SELECT pr.user_id, u.email AS email
           FROM public.password_reset_tokens pr
           JOIN public.users u
             ON u.id = pr.user_id
          WHERE pr.token_hash = ANY($1::varchar[])
          LIMIT 1`,
        [tokenHashes(token)]
      );
      const ownerUserId = ownerResult.rows[0]?.user_id;
      if (!ownerUserId) return null;
      const ownerEmailHash = normalizeEmail(ownerResult.rows[0]?.email);
      const ownerEmailMatches = ownerEmailHash === expectedEmailHash;

      const lockedUser = await client.query<{ id: string }>(
        'SELECT id FROM public.users WHERE id = $1 FOR UPDATE',
        [ownerUserId]
      );
      if (!lockedUser.rows[0]) return null;

      // Identity-changing operations serialize user -> sessions before any
      // token row, matching refresh rotation and retention cleanup.
      const sessions = await client.query<{ id: string }>(
        `SELECT id
           FROM public.auth_sessions
          WHERE user_id = $1
          ORDER BY id
          FOR UPDATE`,
        [ownerUserId]
      );

      const tokenResult = await client.query<{
        id: string;
        user_id: string;
        expires_at: Date | string;
        consumed_at: Date | string | null;
        email_confirmation_code_hash: string | null;
        email_confirmation_code_expires_at: Date | string | null;
        email_confirmation_attempts: number;
        database_now: Date | string;
      }>(
        `SELECT id, user_id, expires_at, consumed_at,
                email_confirmation_code_hash,
                email_confirmation_code_expires_at,
                COALESCE(email_confirmation_attempts, 0) AS email_confirmation_attempts,
                clock_timestamp() AS database_now
           FROM public.password_reset_tokens
          WHERE token_hash = ANY($1::varchar[])
            AND user_id = $2
          LIMIT 1
          FOR UPDATE`,
        [tokenHashes(token), ownerUserId]
      );
      const resetToken = tokenResult.rows[0];
      if (
        !resetToken ||
        resetToken.consumed_at ||
        new Date(resetToken.expires_at).getTime() <= new Date(resetToken.database_now).getTime() ||
        !resetToken.email_confirmation_code_hash ||
        !resetToken.email_confirmation_code_expires_at ||
        new Date(resetToken.email_confirmation_code_expires_at).getTime() <=
          new Date(resetToken.database_now).getTime()
      ) {
        return null;
      }

      if (resetToken.email_confirmation_attempts >= MAX_PASSWORD_RESET_CONFIRMATION_ATTEMPTS) {
        await client.query(
          `UPDATE public.password_reset_tokens
              SET consumed_at = COALESCE(consumed_at, NOW())
            WHERE id = $1`,
          [resetToken.id]
        );
        return null;
      }

      if (
        !ownerEmailMatches ||
        !isPasswordResetCodeHashMatch(
          resetToken.email_confirmation_code_hash.toLowerCase(),
          expectedCodeHashNormalized
        )
      ) {
        await client.query(
          `UPDATE public.password_reset_tokens
              SET email_confirmation_attempts = email_confirmation_attempts + 1
            WHERE id = $1`,
          [resetToken.id]
        );
        return null;
      }

      await client.query(
        `UPDATE public.password_reset_tokens
            SET consumed_at = NOW()
          WHERE id = $1`,
        [resetToken.id]
      );
      const passwordUpdate = await client.query<{ id: string }>(
        `UPDATE public.users
            SET password_hash = $2,
                password_changed_at = NOW(),
                token_version = token_version + 1
          WHERE id = $1
          RETURNING id`,
        [resetToken.user_id, passwordHash]
      );
      if (!passwordUpdate.rows[0]) return null;

      await client.query(
        `UPDATE public.password_reset_tokens
            SET consumed_at = COALESCE(consumed_at, NOW())
          WHERE user_id = $1
            AND consumed_at IS NULL`,
        [resetToken.user_id]
      );
      for (const session of sessions.rows) {
        await revokeSessionInTransaction(client, session.id, 'password_reset');
      }
      return resetToken.user_id;
    });
  }
}

export const sessionRepository = new SessionRepository();
