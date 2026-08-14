/**
 * lib/db.ts — Legacy compatibility layer (Supabase)
 * All functions now use Supabase instead of better-sqlite3.
 * Kept for backward compatibility with existing imports.
 */

import { supabase } from '@/lib/supabase';

export type PlanInterest = 'start' | 'prime' | 'elite';

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  plan_interest: PlanInterest | null;
  sponsor_id: string | null;
  referral_code: string;
  reset_token: string | null;
  reset_token_expires: string | null;
  created_at: string;
  avatar_url: string | null;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  planInterest: PlanInterest | null;
  sponsorId: string | null;
  referralCode: string;
  createdAt: string;
  avatarUrl: string | null;
};

type NewUserInput = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  planInterest: PlanInterest | null;
  sponsorId?: string | null;
  referralCode: string;
  createdAt: string;
};

export function mapUser(record: UserRecord): PublicUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    planInterest: record.plan_interest,
    sponsorId: record.sponsor_id ?? null,
    referralCode: record.referral_code ?? '',
    createdAt: record.created_at,
    avatarUrl: record.avatar_url ?? null,
  };
}

export async function updateAvatarUrl(userId: string, avatarUrl: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);
  return !error;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();
  return (data as UserRecord) ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as UserRecord) ?? null;
}

export async function findUserByReferralCode(referralCode: string): Promise<UserRecord | null> {
  if (!referralCode?.trim()) return null;
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('referral_code', referralCode.trim())
    .maybeSingle();
  return (data as UserRecord) ?? null;
}

export async function createUser(input: NewUserInput): Promise<UserRecord> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: input.id,
      name: input.name,
      email: input.email,
      password_hash: input.passwordHash,
      plan_interest: input.planInterest,
      sponsor_id: input.sponsorId ?? null,
      referral_code: input.referralCode,
      created_at: input.createdAt,
    })
    .select()
    .single();

  if (error || !data) throw new Error('User record was not created: ' + error?.message);
  return data as UserRecord;
}

export async function listUserCount(): Promise<number> {
  const { count } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export async function setPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ reset_token: token, reset_token_expires: expiresAt.toISOString() })
    .ilike('email', email);
  return !error;
}

export async function findUserByResetToken(token: string): Promise<UserRecord | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('reset_token', token)
    .gt('reset_token_expires', new Date().toISOString())
    .maybeSingle();
  return (data as UserRecord) ?? null;
}

export async function updatePassword(userId: string, newPasswordHash: string): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ password_hash: newPasswordHash, reset_token: null, reset_token_expires: null })
    .eq('id', userId);
  return !error;
}

export async function clearResetToken(userId: string): Promise<void> {
  await supabase
    .from('users')
    .update({ reset_token: null, reset_token_expires: null })
    .eq('id', userId);
}
