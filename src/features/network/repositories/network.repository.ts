/**
 * Network Repository — Supabase Postgres
 */

import { supabase } from '@/lib/supabase';
import type { NetworkMember } from '../network.contract';

type UserRow = {
  id: string;
  name: string;
  email: string;
  plan_interest: string | null;
  sponsor_id: string | null;
  referral_code: string;
  created_at: string;
  avatar_url: string | null;
  career: string | null;
};

function rowToMember(row: UserRow, level: number): NetworkMember {
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
    createdAt: row.created_at,
    level,
  };
}

export class NetworkRepository {
  async findReferralCodeByUserId(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .maybeSingle();
    return data?.referral_code ?? null;
  }

  async getDirectReferrals(sponsorId: string): Promise<NetworkMember[]> {
    const { data } = await supabase
      .from('users')
      .select('id, name, email, plan_interest, sponsor_id, referral_code, created_at, avatar_url, career')
      .eq('sponsor_id', sponsorId)
      .order('created_at', { ascending: true });
    return (data ?? []).map((r) => rowToMember(r as UserRow, 1));
  }

  async getUsersByIds(ids: string[]): Promise<UserRow[]> {
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from('users')
      .select('id, name, email, plan_interest, sponsor_id, referral_code, created_at, avatar_url, career')
      .in('id', ids);
    return (data ?? []) as UserRow[];
  }

  async getUserById(userId: string): Promise<UserRow | null> {
    const rows = await this.getUsersByIds([userId]);
    return rows[0] ?? null;
  }
}

export const networkRepository = new NetworkRepository();
