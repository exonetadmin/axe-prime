import '@/src/server/server-only';

import type { PoolClient } from 'pg';
import { execute, queryOne, withTransaction } from '@/src/server/db/postgres';
import { trustedAvatarUrl } from '@/src/features/profile/avatar-url';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  plan_interest: string | null;
  sponsor_id: string | null;
  referral_code: string | null;
  avatar_url: string | null;
  cpf: string | null;
  adhesion_at: string | null;
  plan_monthly_cents: number | null;
  adhesion_value_cents: number | null;
  kyc_submitted: boolean;
  is_active: boolean;
  token_version: number;
  password_changed_at: string | null;
  last_login_at: string | null;
  created_at: string;
};

type UserRow = Omit<
  UserRecord,
  'adhesion_at' | 'password_changed_at' | 'last_login_at' | 'created_at'
> & {
  adhesion_at: Date | string | null;
  password_changed_at: Date | string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planInterest: 'start' | 'prime' | 'elite' | null;
  sponsorId: string | null;
  referralCode: string;
  createdAt: string;
  avatarUrl: string | null;
  cpf: string | null;
  adhesionValueCents: number | null;
};

export type CreateUserData = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone?: string | null;
  planInterest?: 'start' | 'prime' | 'elite' | null;
  sponsorId: string | null;
  referralCode: string;
  createdAt: string;
};

const USER_COLUMNS = `
  id,
  name,
  email,
  password_hash,
  phone,
  plan_interest,
  sponsor_id,
  referral_code,
  avatar_url,
  cpf,
  adhesion_at,
  plan_monthly_cents,
  adhesion_value_cents,
  kyc_submitted,
  is_active,
  token_version,
  password_changed_at,
  last_login_at,
  created_at
`;

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeRecord(row: UserRow): UserRecord {
  return {
    ...row,
    avatar_url: trustedAvatarUrl(row.avatar_url),
    adhesion_at: timestamp(row.adhesion_at),
    password_changed_at: timestamp(row.password_changed_at),
    last_login_at: timestamp(row.last_login_at),
    created_at: timestamp(row.created_at) as string,
  };
}

export function mapUserRecordToDomain(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    planInterest: record.plan_interest as 'start' | 'prime' | 'elite' | null,
    sponsorId: record.sponsor_id,
    referralCode: record.referral_code ?? '',
    createdAt: record.created_at,
    avatarUrl: record.avatar_url,
    cpf: record.cpf,
    adhesionValueCents: record.adhesion_value_cents,
  };
}

async function queryUser(sql: string, values: readonly unknown[]): Promise<UserRecord | null> {
  const row = await queryOne<UserRow>(sql, values);
  return row ? normalizeRecord(row) : null;
}

async function revokeUserSessions(
  client: PoolClient,
  userId: string,
  reason: string
): Promise<void> {
  await client.query(
    `UPDATE public.auth_sessions
       SET revoked_at = COALESCE(revoked_at, NOW()),
           revoke_reason = COALESCE(revoke_reason, $2)
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId, reason]
  );
  await client.query(
    `UPDATE public.auth_refresh_tokens rt
       SET revoked_at = COALESCE(rt.revoked_at, NOW())
      FROM public.auth_sessions s
     WHERE rt.session_id = s.id
       AND s.user_id = $1
       AND rt.revoked_at IS NULL`,
    [userId]
  );
}

export class UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    return queryUser(
      `SELECT ${USER_COLUMNS}
         FROM public.users
        WHERE lower(btrim(email)) = lower(btrim($1))
        LIMIT 1`,
      [email]
    );
  }

  async findById(id: string): Promise<UserRecord | null> {
    return queryUser(
      `SELECT ${USER_COLUMNS}
         FROM public.users
        WHERE id = $1`,
      [id]
    );
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await queryOne<UserRow>(
      `INSERT INTO public.users (
         id, name, email, password_hash, phone, plan_interest,
         sponsor_id, referral_code, created_at
       ) VALUES ($1, $2, lower(btrim($3)), $4, $5, $6, $7, $8, $9)
       RETURNING ${USER_COLUMNS}`,
      [
        data.id,
        data.name.trim(),
        data.email,
        data.passwordHash,
        data.phone ?? null,
        data.planInterest ?? null,
        data.sponsorId,
        data.referralCode,
        data.createdAt,
      ]
    );
    if (!row) throw new Error('Failed to create user');
    return mapUserRecordToDomain(normalizeRecord(row));
  }

  async findByReferralCode(referralCode: string): Promise<UserRecord | null> {
    const code = referralCode.trim().toUpperCase();
    if (!code) return null;
    return queryUser(
      `SELECT ${USER_COLUMNS}
         FROM public.users
        WHERE referral_code = $1`,
      [code]
    );
  }

  /** Rehash after a valid login without invalidating that login. */
  async updatePasswordHash(
    userId: string,
    expectedPasswordHash: string,
    expectedTokenVersion: number,
    newPasswordHash: string
  ): Promise<boolean> {
    return (
      (await execute(
        `UPDATE public.users
            SET password_hash = $2
          WHERE id = $1
            AND password_hash = $3
            AND token_version = $4`,
        [userId, newPasswordHash, expectedPasswordHash, expectedTokenVersion]
      )) > 0
    );
  }

  async markLogin(userId: string): Promise<void> {
    await execute(`UPDATE public.users SET last_login_at = NOW() WHERE id = $1`, [userId]);
  }

  async updateReferralCode(userId: string, referralCode: string): Promise<boolean> {
    return (
      (await execute(`UPDATE public.users SET referral_code = $2 WHERE id = $1`, [
        userId,
        referralCode.trim().toUpperCase(),
      ])) > 0
    );
  }

  async count(): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM public.users'
    );
    return Number.parseInt(row?.count ?? '0', 10);
  }

  async emailExists(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async updateAdhesion(
    userId: string,
    adhesionAt: string,
    planMonthlyCents: number
  ): Promise<boolean> {
    return (
      (await execute(
        `UPDATE public.users
            SET adhesion_at = $2,
                adhesion_paid = TRUE,
                plan_monthly_cents = $3
          WHERE id = $1`,
        [userId, adhesionAt, planMonthlyCents]
      )) > 0
    );
  }

  async getAdhesion(userId: string): Promise<{
    adhesionAt: string | null;
    planMonthlyCents: number | null;
  } | null> {
    const row = await queryOne<{
      adhesion_at: Date | string | null;
      plan_monthly_cents: number | null;
    }>(
      `SELECT adhesion_at, plan_monthly_cents
         FROM public.users
        WHERE id = $1`,
      [userId]
    );
    if (!row) return null;
    return {
      adhesionAt: timestamp(row.adhesion_at),
      planMonthlyCents: row.plan_monthly_cents,
    };
  }

  /** Disabling an account invalidates every token already issued to it. */
  async setActive(userId: string, active: boolean): Promise<boolean> {
    return withTransaction(async client => {
      const result = await client.query(
        `UPDATE public.users
            SET is_active = $2,
                token_version = token_version + 1
          WHERE id = $1
            AND is_active IS DISTINCT FROM $2`,
        [userId, active]
      );
      if ((result.rowCount ?? 0) === 0) {
        const exists = await client.query('SELECT 1 FROM public.users WHERE id = $1', [userId]);
        return (exists.rowCount ?? 0) > 0;
      }
      await revokeUserSessions(client, userId, active ? 'account_reactivated' : 'account_disabled');
      return true;
    });
  }
}

export const userRepository = new UserRepository();
