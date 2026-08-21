import '@/src/server/server-only';

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { cookies, headers } from 'next/headers';
import { execute, queryOne, withTransaction } from '@/src/server/db/postgres';
import { authRateLimiter } from '@/src/server/security/rate-limit';
import { maybePruneExpiredAuthRecords } from '@/src/server/security/auth-record-cleanup';
import { getSessionContextFromHeaders } from '@/src/server/security/request';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  createCsrfToken,
  createRefreshToken,
  hashOpaqueToken,
  readBearerToken,
  signAccessToken,
  verifyAccessToken,
  type VerifiedAccessToken,
} from '@/src/server/security/tokens';
import type { AdminRole, AdminUser, AuthenticatedAdminUser } from './admin.types';

export const ADMIN_ACCESS_COOKIE = 'axeprime_admin_access_token';
export const ADMIN_REFRESH_COOKIE = 'axeprime_admin_refresh_token';
export const ADMIN_CSRF_COOKIE = 'axeprime_admin_csrf_token';
const LEGACY_ADMIN_COOKIE = 'admin_session';
const ADMIN_COOKIE_PATH = '/admin';

const ADMIN_ROLES: readonly AdminRole[] = ['master', 'financeiro', 'suporte'];

type ActiveAdminSessionRow = AdminUser & {
  session_id: string;
  token_version: number;
};

type AdminRefreshOwnerRow = {
  session_id: string;
  admin_user_id: string | null;
};

type LockedAdminRow = AdminUser & {
  active: boolean;
  token_version: number;
};

type LockedAdminSessionRow = {
  id: string;
  admin_user_id: string | null;
  user_id: string | null;
  token_version: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  database_now: Date | string;
};

type LockedAdminRefreshTokenRow = {
  id: string;
  session_id: string;
  consumed_at: Date | string | null;
  revoked_at: Date | string | null;
  expires_at: Date | string;
};

export type AdminSessionState = {
  user: AdminUser;
  accessTokenExpiresAt: Date;
};

export type AdminRefreshResult =
  | ({ status: 'ok' } & AdminSessionState)
  | { status: 'already_rotated' }
  | { status: 'invalid' | 'replayed' };

const ADMIN_REFRESH_REUSE_GRACE_MILLISECONDS = 10_000;

export class AdminAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(message = 'Sessão administrativa inválida.', status: 401 | 403 = 401) {
    super(message);
    this.name = 'AdminAuthorizationError';
    this.status = status;
  }
}

function isAdminRole(role: string): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: ADMIN_COOKIE_PATH,
    maxAge,
  };
}

function csrfCookieOptions(maxAge: number) {
  return {
    ...cookieOptions(maxAge),
    httpOnly: false,
  };
}

async function writeAdminCookies(accessToken: string, refreshToken: string): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  jar.set(ADMIN_REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_TTL_SECONDS));
  jar.set(ADMIN_CSRF_COOKIE, createCsrfToken(), csrfCookieOptions(REFRESH_TOKEN_TTL_SECONDS));
  jar.set(LEGACY_ADMIN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

async function clearAdminCookies(): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_ACCESS_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  jar.set(ADMIN_REFRESH_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  jar.set(ADMIN_CSRF_COOKIE, '', { ...csrfCookieOptions(0), maxAge: 0 });
  jar.set(LEGACY_ADMIN_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

async function revokeAdminSessionInTransaction(
  client: PoolClient,
  sessionId: string,
  reason: string
): Promise<void> {
  await client.query(
    `UPDATE public.auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW()),
            revoke_reason = COALESCE(revoke_reason, $2)
      WHERE id = $1::uuid`,
    [sessionId, reason]
  );
  await client.query(
    `UPDATE public.auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE session_id = $1::uuid
        AND revoked_at IS NULL`,
    [sessionId]
  );
}

async function loadActiveAdminSession(
  sessionId: string,
  adminId: string
): Promise<ActiveAdminSessionRow | null> {
  const row = await queryOne<ActiveAdminSessionRow>(
    `SELECT admin.id,
            admin.name,
            admin.email,
            admin.role,
            admin.token_version,
            session.id::text AS session_id
       FROM public.auth_sessions AS session
       JOIN public.admin_users AS admin
         ON admin.id = session.admin_user_id
      WHERE session.id = $1::uuid
        AND session.admin_user_id = $2
        AND session.user_id IS NULL
        AND session.revoked_at IS NULL
        AND session.expires_at > NOW()
        AND session.token_version = admin.token_version
        AND admin.active = TRUE
      LIMIT 1`,
    [sessionId, adminId]
  );
  return row && isAdminRole(row.role) ? row : null;
}

async function touchSession(sessionId: string): Promise<void> {
  await execute(
    `UPDATE public.auth_sessions
        SET last_seen_at = NOW()
      WHERE id = $1::uuid
        AND last_seen_at < NOW() - INTERVAL '5 minutes'`,
    [sessionId]
  );
}

function toAdminUser(row: ActiveAdminSessionRow): AdminUser {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

async function resolveAccessPrincipal(
  principal: VerifiedAccessToken | null
): Promise<AdminUser | null> {
  if (!principal || principal.principalType !== 'admin') return null;
  const row = await loadActiveAdminSession(principal.sessionId, principal.subject);
  if (!row || row.token_version !== principal.tokenVersion) return null;
  await touchSession(row.session_id);
  return toAdminUser(row);
}

/**
 * Distributed fixed-window limiter for administrative login attempts. The
 * caller identity is stored only as a keyed digest, so neither IP nor e-mail
 * is persisted in clear text.
 */
export async function consumeAdminLoginRateLimit(identity: string): Promise<boolean> {
  const decision = await authRateLimiter.consume(
    'admin-login',
    identity.normalize('NFC').toLowerCase(),
    { limit: 5, windowSeconds: 15 * 60, blockSeconds: 15 * 60 }
  );
  return decision.allowed;
}

/**
 * Caps aggregate password hashing work even when no trustworthy client IP is
 * available. This bucket is intentionally never reset after a successful
 * login, otherwise a distributed attacker with one valid account could bypass
 * the process-wide protection.
 */
export async function consumeAdminLoginGlobalRateLimit(): Promise<boolean> {
  const decision = await authRateLimiter.consume('admin-login-global', 'all', {
    limit: 30,
    windowSeconds: 60,
    blockSeconds: 60,
  });
  return decision.allowed;
}

export async function clearAdminLoginRateLimit(identity: string): Promise<void> {
  await authRateLimiter.reset('admin-login', identity.normalize('NFC').toLowerCase());
}

/** Validate credentials without ever returning a password or password hash. */
export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<AuthenticatedAdminUser | null> {
  const { configRepository } = await import('./config.repository');
  return configRepository.validateCredentials(email, password);
}

/** Create a revocable DB session plus a signed short-lived access JWT. */
export async function createAdminSession(user: AuthenticatedAdminUser): Promise<void> {
  await maybePruneExpiredAuthRecords();
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken();
  const refreshHash = hashOpaqueToken(refreshToken);
  const requestHeaders = await headers();
  const { userAgentHash, ipAddress } = getSessionContextFromHeaders(requestHeaders);

  const session = await withTransaction(async client => {
    const adminResult = await client.query<{
      id: string;
      role: string;
      token_version: number;
    }>(
      `SELECT id, role, token_version
         FROM public.admin_users
        WHERE id = $1
          AND active = TRUE
          AND token_version = $2
        FOR UPDATE`,
      [user.id, user.tokenVersion]
    );
    const admin = adminResult.rows[0];
    if (!admin || !isAdminRole(admin.role)) {
      throw new AdminAuthorizationError();
    }

    const sessionResult = await client.query<{ expires_at: Date | string }>(
      `INSERT INTO public.auth_sessions
         (id, admin_user_id, token_version, expires_at, user_agent_hash, ip_address)
       VALUES (
         $1::uuid, $2, $3,
         NOW() + ($4::integer * INTERVAL '1 second'),
         $5, $6::inet
       )
       RETURNING expires_at`,
      [
        sessionId,
        admin.id,
        admin.token_version,
        REFRESH_TOKEN_TTL_SECONDS,
        userAgentHash,
        ipAddress,
      ]
    );
    const sessionExpiresAt = sessionResult.rows[0]?.expires_at;
    if (!sessionExpiresAt) throw new Error('Admin session expiry was not returned');
    await client.query(
      `INSERT INTO public.auth_refresh_tokens
         (session_id, token_hash, expires_at)
       VALUES ($1::uuid, $2, $3)`,
      [sessionId, refreshHash, sessionExpiresAt]
    );
    return admin;
  });

  try {
    const { token: accessToken } = await signAccessToken({
      subject: session.id,
      sessionId,
      principalType: 'admin',
      tokenVersion: session.token_version,
      role: session.role,
    });
    await writeAdminCookies(accessToken, refreshToken);
  } catch (error) {
    try {
      await withTransaction(client =>
        revokeAdminSessionInTransaction(client, sessionId, 'credential_delivery_failed')
      );
      await clearAdminCookies();
    } catch (cleanupError) {
      console.error('[Admin Auth] Failed to clean up an undelivered session', cleanupError);
    }
    throw error;
  }
}

/**
 * Read the admin principal only from a signed, short-lived access token.
 * Refresh credentials are accepted exclusively by the protected rotation
 * endpoint, never as passive authentication for pages or mutations.
 */
export async function getAdminSessionState(): Promise<AdminSessionState | null> {
  const jar = await cookies();
  const accessToken = jar.get(ADMIN_ACCESS_COOKIE)?.value;
  const principal = await verifyAccessToken(accessToken);
  const user = await resolveAccessPrincipal(principal);
  if (!principal || !user) return null;
  return {
    user,
    accessTokenExpiresAt: new Date(principal.expiresAt * 1000),
  };
}

export async function getAdminSession(): Promise<AdminUser | null> {
  return (await getAdminSessionState())?.user ?? null;
}

/** Authenticate an API request carrying `Authorization: Bearer <JWT>`. */
export async function getAdminFromBearer(request: Request): Promise<AdminUser | null> {
  const principal = await verifyAccessToken(readBearerToken(request));
  return resolveAccessPrincipal(principal);
}

/** Rotate the opaque refresh token and mint a new signed access token. */
export async function refreshAdminSession(): Promise<AdminRefreshResult> {
  await maybePruneExpiredAuthRecords();
  const jar = await cookies();
  const currentToken = jar.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!currentToken) {
    await clearAdminCookies();
    return { status: 'invalid' };
  }

  const currentHash = hashOpaqueToken(currentToken);
  const replacementToken = createRefreshToken();
  const replacementHash = hashOpaqueToken(replacementToken);
  const replacementId = randomUUID();

  const rotation = await withTransaction(async client => {
    // Resolve without a row lock, then use the same explicit lock order as
    // account mutations: admin -> session -> refresh token.
    const ownerResult = await client.query<AdminRefreshOwnerRow>(
      `SELECT token.session_id::text AS session_id,
              session.admin_user_id
         FROM public.auth_refresh_tokens AS token
         JOIN public.auth_sessions AS session ON session.id = token.session_id
        WHERE token.token_hash = $1
        LIMIT 1`,
      [currentHash]
    );
    const owner = ownerResult.rows[0];
    if (!owner?.session_id || !owner.admin_user_id) {
      return { status: 'invalid' as const };
    }

    const adminResult = await client.query<LockedAdminRow>(
      `SELECT id, name, email, role, active, token_version
         FROM public.admin_users
        WHERE id = $1
        FOR UPDATE`,
      [owner.admin_user_id]
    );
    const admin = adminResult.rows[0];
    if (!admin) return { status: 'invalid' as const };

    const sessionResult = await client.query<LockedAdminSessionRow>(
      `SELECT id::text AS id,
              admin_user_id,
              user_id,
              token_version,
              expires_at,
              revoked_at,
              clock_timestamp() AS database_now
         FROM public.auth_sessions
        WHERE id = $1::uuid
          AND admin_user_id = $2
        FOR UPDATE`,
      [owner.session_id, admin.id]
    );
    const session = sessionResult.rows[0];
    if (!session || session.user_id !== null) return { status: 'invalid' as const };

    const tokenResult = await client.query<LockedAdminRefreshTokenRow>(
      `SELECT id::text AS id,
              session_id::text AS session_id,
              consumed_at,
              revoked_at,
              expires_at
         FROM public.auth_refresh_tokens
        WHERE token_hash = $1
          AND session_id = $2::uuid
        LIMIT 1
        FOR UPDATE`,
      [currentHash, session.id]
    );
    const token = tokenResult.rows[0];
    if (!token) return { status: 'invalid' as const };

    const databaseNow = new Date(session.database_now);
    const sessionExpiresAt = new Date(session.expires_at);
    const refreshExpiresAt = new Date(token.expires_at);
    if (
      !Number.isFinite(databaseNow.getTime()) ||
      !Number.isFinite(sessionExpiresAt.getTime()) ||
      !Number.isFinite(refreshExpiresAt.getTime())
    ) {
      throw new Error('Invalid admin session timestamp returned by PostgreSQL');
    }

    if (
      !admin.active ||
      !isAdminRole(admin.role) ||
      session.admin_user_id !== admin.id ||
      session.token_version !== admin.token_version ||
      session.revoked_at ||
      sessionExpiresAt.getTime() <= databaseNow.getTime()
    ) {
      await revokeAdminSessionInTransaction(client, session.id, 'identity_or_session_changed');
      return { status: 'invalid' as const };
    }

    if (token.consumed_at) {
      const consumedAt = new Date(token.consumed_at);
      const tokenAge = databaseNow.getTime() - consumedAt.getTime();
      if (
        Number.isFinite(consumedAt.getTime()) &&
        tokenAge >= 0 &&
        tokenAge <= ADMIN_REFRESH_REUSE_GRACE_MILLISECONDS
      ) {
        // Another concurrent request completed the same rotation. Do not clear
        // cookies: its Set-Cookie response may still be in flight.
        return { status: 'already_rotated' as const };
      }
      await revokeAdminSessionInTransaction(client, session.id, 'refresh_token_replay');
      return { status: 'replayed' as const };
    }

    if (token.revoked_at || refreshExpiresAt.getTime() <= databaseNow.getTime()) {
      await revokeAdminSessionInTransaction(client, session.id, 'refresh_token_invalid');
      return { status: 'invalid' as const };
    }

    await client.query(
      `UPDATE public.auth_refresh_tokens
          SET consumed_at = NOW()
        WHERE id = $1::uuid`,
      [token.id]
    );
    await client.query(
      `INSERT INTO public.auth_refresh_tokens
         (id, session_id, token_hash, expires_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)`,
      [replacementId, session.id, replacementHash, refreshExpiresAt]
    );
    await client.query(
      `UPDATE public.auth_refresh_tokens
          SET replaced_by_token_id = $2::uuid
        WHERE id = $1::uuid`,
      [token.id, replacementId]
    );
    await client.query(
      `UPDATE public.auth_sessions
          SET last_seen_at = NOW()
        WHERE id = $1::uuid`,
      [session.id]
    );
    return {
      status: 'ok' as const,
      admin,
      sessionId: session.id,
      refreshExpiresAt,
      refreshRemainingSeconds: Math.max(
        1,
        Math.floor((refreshExpiresAt.getTime() - databaseNow.getTime()) / 1000)
      ),
    };
  });

  if (rotation.status === 'already_rotated') return rotation;
  if (rotation.status !== 'ok') {
    await clearAdminCookies();
    return rotation;
  }

  try {
    const { token: accessToken, expiresAt: accessTokenExpiresAt } = await signAccessToken({
      subject: rotation.admin.id,
      sessionId: rotation.sessionId,
      principalType: 'admin',
      tokenVersion: rotation.admin.token_version,
      role: rotation.admin.role,
    });
    const cookieJar = await cookies();
    cookieJar.set(ADMIN_ACCESS_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_TTL_SECONDS));
    cookieJar.set(
      ADMIN_REFRESH_COOKIE,
      replacementToken,
      cookieOptions(rotation.refreshRemainingSeconds)
    );
    return {
      status: 'ok',
      user: toAdminUser({
        ...rotation.admin,
        session_id: rotation.sessionId,
      }),
      accessTokenExpiresAt,
    };
  } catch (error) {
    try {
      await withTransaction(client =>
        revokeAdminSessionInTransaction(client, rotation.sessionId, 'credential_delivery_failed')
      );
      await clearAdminCookies();
    } catch (cleanupError) {
      console.error('[Admin Auth] Failed to clean up an undelivered rotation', cleanupError);
    }
    throw error;
  }
}

export async function requireAdmin(allowedRoles?: readonly AdminRole[]): Promise<AdminUser> {
  const admin = await getAdminSession();
  if (!admin) throw new AdminAuthorizationError();
  if (allowedRoles && !allowedRoles.includes(admin.role)) {
    throw new AdminAuthorizationError('Sem permissão para esta operação.', 403);
  }
  return admin;
}

/** Revoke the current database session and both bearer credentials. */
export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const access = await verifyAccessToken(jar.get(ADMIN_ACCESS_COOKIE)?.value);
  const refreshToken = jar.get(ADMIN_REFRESH_COOKIE)?.value;
  const refreshHash = refreshToken ? hashOpaqueToken(refreshToken) : null;

  await withTransaction(async client => {
    let sessionId = access?.principalType === 'admin' ? access.sessionId : null;
    if (!sessionId && refreshHash) {
      const result = await client.query<{ session_id: string }>(
        `SELECT session_id::text AS session_id
           FROM public.auth_refresh_tokens
          WHERE token_hash = $1
          LIMIT 1`,
        [refreshHash]
      );
      sessionId = result.rows[0]?.session_id ?? null;
    }
    if (!sessionId) return;

    await client.query(
      `UPDATE public.auth_sessions
          SET revoked_at = COALESCE(revoked_at, NOW()),
              revoke_reason = COALESCE(revoke_reason, 'logout')
        WHERE id = $1::uuid`,
      [sessionId]
    );
    await client.query(
      `UPDATE public.auth_refresh_tokens
          SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE session_id = $1::uuid
          AND revoked_at IS NULL`,
      [sessionId]
    );
  });

  await clearAdminCookies();
}
