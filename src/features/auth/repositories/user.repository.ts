/**
 * User Repository — Supabase Postgres
 * Substitui better-sqlite3 da versão local.
 */

import { supabase } from '@/lib/supabase';


// ── Types ──────────────────────────────────────────────────────────────────────

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  plan_interest: string | null;
  sponsor_id: string | null;
  referral_code: string | null;
  avatar_url: string | null;
  cpf: string | null;
  reset_token: string | null;
  reset_token_expires: string | null;
  adhesion_at: string | null;
  plan_monthly_cents: number | null;
  adhesion_value_cents: number | null;
  kyc_submitted: boolean;
  is_active: boolean;
  created_at: string;
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

function mapToDomain(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: (record as Record<string, unknown>).phone as string | null ?? null,
    planInterest: record.plan_interest as 'start' | 'prime' | 'elite' | null,
    sponsorId: record.sponsor_id ?? null,
    referralCode: record.referral_code ?? '',
    createdAt: record.created_at,
    avatarUrl: record.avatar_url ?? null,
    cpf: record.cpf ?? null,
    adhesionValueCents: record.adhesion_value_cents ?? null,
  };
}

// ── Repository ─────────────────────────────────────────────────────────────────

export class UserRepository {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ?? null;
  }

  async create(data: CreateUserData): Promise<User> {
    const { data: row, error } = await supabase
      .from('users')
      .insert({
        id: data.id,
        name: data.name,
        email: data.email,
        password_hash: data.passwordHash,
        phone: data.phone ?? null,
        plan_interest: data.planInterest ?? null,
        sponsor_id: data.sponsorId ?? null,
        referral_code: data.referralCode,
        created_at: data.createdAt,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);
    return mapToDomain(row as UserRecord);
  }

  async findByReferralCode(referralCode: string): Promise<UserRecord | null> {
    if (!referralCode?.trim()) return null;
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('referral_code', referralCode.trim())
      .maybeSingle();
    return data ?? null;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash, reset_token: null, reset_token_expires: null })
      .eq('id', userId);
    return !error && (count ?? 0) > 0;
  }

  async setResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const { error, count } = await supabase
      .from('users')
      .update({ reset_token: token, reset_token_expires: expiresAt.toISOString() })
      .ilike('email', email);
    return !error && (count ?? 0) > 0;
  }

  async findByResetToken(token: string): Promise<UserRecord | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      .gt('reset_token_expires', new Date().toISOString())
      .maybeSingle();
    return data ?? null;
  }

  async clearResetToken(userId: string): Promise<void> {
    await supabase
      .from('users')
      .update({ reset_token: null, reset_token_expires: null })
      .eq('id', userId);
  }

  async updateReferralCode(userId: string, referralCode: string): Promise<boolean> {
    const { error, count } = await supabase
      .from('users')
      .update({ referral_code: referralCode })
      .eq('id', userId);
    return !error && (count ?? 0) > 0;
  }

  async count(): Promise<number> {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    return count ?? 0;
  }

  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }

  async updateAdhesion(
    userId: string,
    adhesionAt: string,
    planMonthlyCents: number
  ): Promise<boolean> {
    const { error, count } = await supabase
      .from('users')
      .update({ adhesion_at: adhesionAt, plan_monthly_cents: planMonthlyCents })
      .eq('id', userId);
    return !error && (count ?? 0) > 0;
  }

  async getAdhesion(userId: string): Promise<{
    adhesionAt: string | null;
    planMonthlyCents: number | null;
  } | null> {
    const { data } = await supabase
      .from('users')
      .select('adhesion_at, plan_monthly_cents')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      adhesionAt: data.adhesion_at,
      planMonthlyCents: data.plan_monthly_cents,
    };
  }

  /** Ativa ou desativa o acesso de um usuário. */
  async setActive(userId: string, active: boolean): Promise<boolean> {
    const { error, count } = await supabase
      .from('users')
      .update({ is_active: active })
      .eq('id', userId);
    return !error && (count ?? 0) > 0;
  }
}

export const userRepository = new UserRepository();
