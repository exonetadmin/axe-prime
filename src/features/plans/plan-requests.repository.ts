/**
 * Plan Requests Repository — Supabase Postgres
 */

import { supabase } from '@/lib/supabase';

export type PlanRequestType   = 'onboarding' | 'plan_change';
export type PlanRequestStatus = 'pending' | 'approved' | 'rejected';
export type PlanInterest      = 'start' | 'prime' | 'elite';

export type PlanRequestRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: PlanRequestType;
  status: PlanRequestStatus;
  requested_plan: PlanInterest;
  monthly_investment_cents: number;
  // KYC fields
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issue_date: string | null;
  rg_issuer: string | null;
  birth_date: string | null;
  birth_state: string | null;
  birth_city: string | null;
  father_name: string | null;
  mother_name: string | null;
  profession: string | null;
  monthly_income_cents: number | null;
  patrimony_cents: number | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
  email: string | null;
  marital_status: string | null;
  // Legacy
  doc_type: string | null;
  doc_number: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type CreatePlanRequestData = {
  id: string;
  userId: string;
  type: PlanRequestType;
  requestedPlan: PlanInterest;
  monthlyInvestmentCents: number;
  // KYC fields
  fullName?: string;
  cpf?: string;
  rg?: string;
  rgIssueDate?: string;
  rgIssuer?: string;
  birthDate?: string;
  birthState?: string;
  birthCity?: string;
  fatherName?: string;
  motherName?: string;
  profession?: string;
  monthlyIncomeCents?: number;
  patrimonyCents?: number;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  phone?: string;
  email?: string;
  maritalStatus?: string;
  // Legacy
  docType?: string;
  docNumber?: string;
};

class PlanRequestsRepository {
  async createRequest(data: CreatePlanRequestData): Promise<void> {
    const { error } = await supabase.from('plan_requests').insert({
      id: data.id,
      user_id: data.userId,
      type: data.type,
      status: 'pending',
      requested_plan: data.requestedPlan,
      monthly_investment_cents: data.monthlyInvestmentCents,
      // KYC
      full_name: data.fullName ?? null,
      cpf: data.cpf ?? null,
      rg: data.rg ?? null,
      rg_issue_date: data.rgIssueDate ?? null,
      rg_issuer: data.rgIssuer ?? null,
      birth_date: data.birthDate ?? null,
      birth_state: data.birthState ?? null,
      birth_city: data.birthCity ?? null,
      father_name: data.fatherName ?? null,
      mother_name: data.motherName ?? null,
      profession: data.profession ?? null,
      monthly_income_cents: data.monthlyIncomeCents ?? null,
      patrimony_cents: data.patrimonyCents ?? null,
      address_cep: data.addressCep ?? null,
      address_street: data.addressStreet ?? null,
      address_number: data.addressNumber ?? null,
      address_complement: data.addressComplement ?? null,
      address_city: data.addressCity ?? null,
      address_state: data.addressState ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      marital_status: data.maritalStatus ?? null,
      // Legacy
      doc_type: data.docType ?? null,
      doc_number: data.docNumber ?? null,
    });
    if (error) throw new Error(`createRequest failed: ${error.message}`);
  }

  async markKycSubmitted(userId: string): Promise<void> {
    const { error } = await supabase.from('users').update({ kyc_submitted: true }).eq('id', userId);
    if (error) {
      console.error('[markKycSubmitted] FAILED for user', userId, error);
      throw new Error(`markKycSubmitted failed: ${error.message}`);
    }
    console.log('[markKycSubmitted] SUCCESS for user', userId);
  }

  async hasSubmittedKyc(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('users')
      .select('kyc_submitted')
      .eq('id', userId)
      .maybeSingle();
    return data?.kyc_submitted === true;
  }

  async getUserPendingRequest(userId: string): Promise<PlanRequestRow | null> {
    const { data } = await supabase
      .from('plan_requests')
      .select(`*, users!inner(name, email)`)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    const u = (data as { users: { name: string; email: string } }).users;
    return { ...data, user_name: u.name, user_email: u.email } as PlanRequestRow;
  }

  async listRequests(
    status: PlanRequestStatus | 'all' = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: PlanRequestRow[]; total: number }> {
    let query = supabase
      .from('plan_requests')
      .select(`*, users!inner(name, email)`, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw new Error(`listRequests failed: ${error.message}`);

    type PlanReqJoined = { users?: { name: string; email: string }; [key: string]: unknown };
    const rows = (data ?? []).map((r: PlanReqJoined) => ({
      ...r,
      user_name: r.users?.name ?? '',
      user_email: r.users?.email ?? '',
    })) as PlanRequestRow[];

    return { rows, total: count ?? 0 };
  }

  async countByStatus(): Promise<Record<PlanRequestStatus, number>> {
    const result: Record<PlanRequestStatus, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const s of ['pending', 'approved', 'rejected'] as PlanRequestStatus[]) {
      const { count } = await supabase
        .from('plan_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', s);
      result[s] = count ?? 0;
    }
    return result;
  }

  async approveRequest(id: string, reviewedBy: string): Promise<void> {
    const { data: req, error: fetchErr } = await supabase
      .from('plan_requests')
      .select('user_id, requested_plan, monthly_investment_cents')
      .eq('id', id)
      .single();

    if (fetchErr || !req) throw new Error('Solicitação não encontrada.');

    const { error: e1 } = await supabase
      .from('plan_requests')
      .update({ status: 'approved', reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (e1) throw new Error(`approveRequest update failed: ${e1.message}`);

    const { error: e2 } = await supabase
      .from('users')
      .update({
        plan_interest: req.requested_plan,
        plan_monthly_cents: req.monthly_investment_cents,
        adhesion_value_cents: req.monthly_investment_cents,
        kyc_submitted: true,
      })
      .eq('id', req.user_id);
    if (e2) throw new Error(`approveRequest user update failed: ${e2.message}`);
  }

  async rejectRequest(id: string, reviewedBy: string, note: string): Promise<void> {
    const { error } = await supabase
      .from('plan_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', id);
    if (error) throw new Error(`rejectRequest failed: ${error.message}`);
  }
}

export const planRequestsRepository = new PlanRequestsRepository();
