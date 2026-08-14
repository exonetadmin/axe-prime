'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { authService } from '@/src/features/auth';
import { planRequestsRepository } from '@/src/features/plans/plan-requests.repository';
import type { PlanInterest } from '@/src/features/plans/plan-requests.repository';

// ── Submit KYC + first plan choice (onboarding) ───────────────────────────────

export async function submitKycAndPlanAction(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await authService.getCurrentUser();
  if (!session) return { error: 'Sessão expirada. Faça login novamente.' };

  const requestedPlan = String(formData.get('requested_plan') ?? '').trim() as PlanInterest;
  if (!['start', 'prime', 'elite'].includes(requestedPlan)) {
    return { error: 'Selecione um plano válido.' };
  }

  const monthlyInvestmentBrl = parseFloat(String(formData.get('monthly_investment') ?? '0'));
  if (isNaN(monthlyInvestmentBrl) || monthlyInvestmentBrl <= 0) {
    return { error: 'Informe um valor de aporte válido.' };
  }

  // Required KYC fields
  const fullName    = String(formData.get('full_name') ?? '').trim();
  const cpf         = String(formData.get('cpf') ?? '').replace(/\D/g, '');
  const rg          = String(formData.get('rg') ?? '').trim();
  const rgIssueDate = String(formData.get('rg_issue_date') ?? '').trim();
  const rgIssuer    = String(formData.get('rg_issuer') ?? '').trim();
  const birthDate   = String(formData.get('birth_date') ?? '').trim();
  const profession  = String(formData.get('profession') ?? '').trim();
  const phone       = String(formData.get('phone') ?? '').trim();
  const email       = String(formData.get('email') ?? '').trim();
  const cep         = String(formData.get('address_cep') ?? '').replace(/\D/g, '');

  if (!fullName || cpf.length < 11 || !rg || !rgIssueDate || !rgIssuer || !birthDate) {
    return { error: 'Preencha todos os dados pessoais obrigatórios.' };
  }
  if (!profession || !phone || !email) {
    return { error: 'Preencha profissão, celular e e-mail.' };
  }
  if (cep.length < 8) {
    return { error: 'Preencha o CEP completo.' };
  }

  // Check if already has pending request
  const pending = await planRequestsRepository.getUserPendingRequest(session.id);
  if (pending) {
    return { error: 'Você já possui uma solicitação de plano em análise.' };
  }

  try {
    await planRequestsRepository.createRequest({
      id: randomUUID(),
      userId: session.id,
      type: 'onboarding',
      requestedPlan,
      monthlyInvestmentCents: Math.round(monthlyInvestmentBrl * 100),
      // KYC
      fullName,
      cpf,
      rg,
      rgIssueDate,
      rgIssuer,
      birthDate,
      birthState: String(formData.get('birth_state') ?? '').trim(),
      birthCity: String(formData.get('birth_city') ?? '').trim(),
      fatherName: String(formData.get('father_name') ?? '').trim(),
      motherName: String(formData.get('mother_name') ?? '').trim(),
      profession,
      monthlyIncomeCents: Math.round(parseFloat(String(formData.get('monthly_income') ?? '0')) * 100),
      patrimonyCents: Math.round(parseFloat(String(formData.get('patrimony') ?? '0')) * 100),
      addressCep: cep,
      addressStreet: String(formData.get('address_street') ?? '').trim(),
      addressNumber: String(formData.get('address_number') ?? '').trim(),
      addressComplement: String(formData.get('address_complement') ?? '').trim(),
      addressCity: String(formData.get('address_city') ?? '').trim(),
      addressState: String(formData.get('address_state') ?? '').trim(),
      phone,
      email,
      maritalStatus: String(formData.get('marital_status') ?? '').trim(),
    });

    await planRequestsRepository.markKycSubmitted(session.id);
    revalidatePath('/portal/planos');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro ao enviar solicitação.' };
  }
}

// ── Submit plan change request (existing user) ────────────────────────────────

export async function submitPlanChangeAction(
  formData: FormData
): Promise<{ error?: string }> {
  const session = await authService.getCurrentUser();
  if (!session) return { error: 'Sessão expirada. Faça login novamente.' };

  const requestedPlan = String(formData.get('requested_plan') ?? '').trim() as PlanInterest;
  if (!['start', 'prime', 'elite'].includes(requestedPlan)) {
    return { error: 'Selecione um plano válido.' };
  }

  const monthlyInvestmentBrl = parseFloat(String(formData.get('monthly_investment') ?? '0'));
  if (isNaN(monthlyInvestmentBrl) || monthlyInvestmentBrl <= 0) {
    return { error: 'Informe um valor de aporte válido.' };
  }

  const pending = await planRequestsRepository.getUserPendingRequest(session.id);
  if (pending) {
    return { error: 'Você já possui uma solicitação em análise. Aguarde a aprovação.' };
  }

  try {
    await planRequestsRepository.createRequest({
      id: randomUUID(),
      userId: session.id,
      type: 'plan_change',
      requestedPlan,
      monthlyInvestmentCents: Math.round(monthlyInvestmentBrl * 100),
    });

    revalidatePath('/portal/planos');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro ao enviar solicitação.' };
  }
}
