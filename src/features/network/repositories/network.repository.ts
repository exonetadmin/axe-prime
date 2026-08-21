/** Network repository. This module is server-only and talks directly to PostgreSQL. */

import 'server-only';

import { query, queryOne } from '@/src/server/db/postgres';
import { trustedAvatarUrl } from '@/src/features/profile/avatar-url';
import type { NetworkMember } from '../network.contract';

export type NetworkUserRow = {
  id: string;
  name: string;
  email: string;
  plan_interest: string | null;
  sponsor_id: string | null;
  referral_code: string;
  created_at: string | Date;
  avatar_url: string | null;
  career: string | null;
};

function asIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function sanitizeRow(row: NetworkUserRow): NetworkUserRow {
  return { ...row, avatar_url: trustedAvatarUrl(row.avatar_url) };
}

function rowToMember(row: NetworkUserRow, level: number): NetworkMember {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    planInterest:
      row.plan_interest === 'start' ||
      row.plan_interest === 'prime' ||
      row.plan_interest === 'elite'
        ? row.plan_interest
        : null,
    referralCode: row.referral_code ?? row.id,
    createdAt: asIsoString(row.created_at),
    level,
  };
}

export class NetworkRepository {
  async findReferralCodeByUserId(userId: string): Promise<string | null> {
    const row = await queryOne<{ referral_code: string | null }>(
      'SELECT referral_code FROM users WHERE id = $1',
      [userId]
    );
    return row?.referral_code ?? null;
  }

  async getDirectReferrals(sponsorId: string): Promise<NetworkMember[]> {
    const rows = await query<NetworkUserRow>(
      `SELECT id, name, email, plan_interest, sponsor_id, referral_code,
              created_at, avatar_url, career
         FROM users
        WHERE sponsor_id = $1
        ORDER BY created_at ASC`,
      [sponsorId]
    );
    return rows.map(row => rowToMember(row, 1));
  }

  async getUsersByIds(ids: string[]): Promise<NetworkUserRow[]> {
    if (ids.length === 0) return [];
    const rows = await query<NetworkUserRow>(
      `SELECT id, name, email, plan_interest, sponsor_id, referral_code,
              created_at, avatar_url, career
         FROM users
        WHERE id = ANY($1::text[])`,
      [ids]
    );
    return rows.map(sanitizeRow);
  }

  async getUserById(userId: string): Promise<NetworkUserRow | null> {
    const row = await queryOne<NetworkUserRow>(
      `SELECT id, name, email, plan_interest, sponsor_id, referral_code,
              created_at, avatar_url, career
         FROM users
        WHERE id = $1`,
      [userId]
    );
    return row ? sanitizeRow(row) : null;
  }
}

export const networkRepository = new NetworkRepository();
