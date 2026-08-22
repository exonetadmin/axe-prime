'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { authService } from '@/src/features/auth';
import {
  PendingPlanRequestError,
  planRequestsRepository,
} from '@/src/features/plans/plan-requests.repository';
import type { PlanInterest } from '@/src/features/plans/plan-requests.repository';
import { authRateLimiter } from '@/src/server/security/rate-limit';
import { isValidBrazilianDate, isValidCpf, normalizeDigits } from '@/src/shared/validation/brasil';

const POSTGRES_INTEGER_MAX = 2_147_483_647;

function parseNonnegativeBrlCents(raw: FormDataEntryValue | null, maximum: number): number | null {
  const normalized = String(raw ?? '').trim();
  if (!normalized) return 0;
  if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const brl = Number(normalized);
  const cents = Math.round(brl * 100);
  if (!Number.isFinite(brl) || !Number.isSafeInteger(cents) || cents < 0 || cents > maximum) {
    return null;
  }
  return cents;
}

const requiredText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .transform(value => value.normalize('NFC'));
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform(value => value.normalize('NFC'));
const stateSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .refine(value => /^[A-Z]{2}$/.test(value));
const optionalStateSchema = z
  .string()
  .trim()
  .transform(value => value.toUpperCase())
  .refine(value => value === '' || /^[A-Z]{2}$/.test(value));
const dateSchema = z
  .string()
  .trim()
  .refine(value => isValidBrazilianDate(value));

const kycSchema = z.object({
  fullName: requiredText(2, 160),
  cpf: z.string().max(20).transform(normalizeDigits).refine(isValidCpf),
  rg: requiredText(3, 30),
  rgIssueDate: dateSchema,
  rgIssuer: requiredText(2, 20),
  birthDate: dateSchema,
  birthState: optionalStateSchema,
  birthCity: optionalText(100),
  fatherName: optionalText(160),
  motherName: optionalText(160),
  profession: requiredText(2, 100),
  addressCep: z
    .string()
    .max(12)
    .transform(normalizeDigits)
    .refine(value => /^\d{8}$/.test(value)),
  addressStreet: requiredText(2, 160),
  addressNumber: requiredText(1, 30),
  addressComplement: optionalText(100),
  addressCity: requiredText(2, 100),
  addressState: stateSchema,
  phone: z
    .string()
    .max(30)
    .transform(normalizeDigits)
    .refine(value => /^\d{10,11}$/.test(value)),
  email: z
    .string()
    .trim()
    .max(320)
    .email()
    .transform(value => value.toLowerCase()),
  maritalStatus: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'separado', 'uniao_estavel']),
});

async function allowPlanMutation(userId: string, action: 'kyc' | 'plan-change'): Promise<boolean> {
  const decision = await authRateLimiter.consume(`plan-${action}`, userId, {
    limit: action === 'kyc' ? 5 : 10,
    windowSeconds: 10 * 60,
    blockSeconds: 10 * 60,
  });
  return decision.allowed;
}

// ── Submit KYC + first plan choice (onboarding) ───────────────────────────────

export async function submitKycAndPlanAction(formData: FormData): Promise<{ error?: string }> {
  const session = await authService.getCurrentAccessUser();
  if (!session) return { error: 'Sessão expirada. Faça login novamente.' };
  if (!(await allowPlanMutation(session.id, 'kyc'))) {
    return { error: 'Muitas tentativas. Aguarde antes de enviar novamente.' };
  }

  const requestedPlan = String(formData.get('requested_plan') ?? '').trim() as PlanInterest;
  if (!['start', 'prime', 'elite'].includes(requestedPlan)) {
    return { error: 'Selecione um plano válido.' };
  }

  const monthlyInvestmentCents = parseNonnegativeBrlCents(
    formData.get('monthly_investment'),
    POSTGRES_INTEGER_MAX
  );
  if (monthlyInvestmentCents === null || monthlyInvestmentCents <= 0) {
    return { error: 'Informe um valor de aporte válido.' };
  }

  const parsedKyc = kycSchema.safeParse({
    fullName: String(formData.get('full_name') ?? ''),
    cpf: String(formData.get('cpf') ?? ''),
    rg: String(formData.get('rg') ?? ''),
    rgIssueDate: String(formData.get('rg_issue_date') ?? ''),
    rgIssuer: String(formData.get('rg_issuer') ?? ''),
    birthDate: String(formData.get('birth_date') ?? ''),
    birthState: String(formData.get('birth_state') ?? ''),
    birthCity: String(formData.get('birth_city') ?? ''),
    fatherName: String(formData.get('father_name') ?? ''),
    motherName: String(formData.get('mother_name') ?? ''),
    profession: String(formData.get('profession') ?? ''),
    addressCep: String(formData.get('address_cep') ?? ''),
    addressStreet: String(formData.get('address_street') ?? ''),
    addressNumber: String(formData.get('address_number') ?? ''),
    addressComplement: String(formData.get('address_complement') ?? ''),
    addressCity: String(formData.get('address_city') ?? ''),
    addressState: String(formData.get('address_state') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    email: String(formData.get('email') ?? ''),
    maritalStatus: String(formData.get('marital_status') ?? ''),
  });
  if (!parsedKyc.success) {
    return { error: 'Dados cadastrais inválidos. Revise os campos e tente novamente.' };
  }
  const kyc = parsedKyc.data;

  const monthlyIncomeCents = parseNonnegativeBrlCents(
    formData.get('monthly_income'),
    POSTGRES_INTEGER_MAX
  );
  const patrimonyCents = parseNonnegativeBrlCents(
    formData.get('patrimony'),
    Number.MAX_SAFE_INTEGER
  );
  if (monthlyIncomeCents === null || patrimonyCents === null) {
    return { error: 'Informe valores financeiros válidos.' };
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
      monthlyInvestmentCents,
      // KYC
      fullName: kyc.fullName,
      cpf: kyc.cpf,
      rg: kyc.rg,
      rgIssueDate: kyc.rgIssueDate,
      rgIssuer: kyc.rgIssuer,
      birthDate: kyc.birthDate,
      birthState: kyc.birthState,
      birthCity: kyc.birthCity,
      fatherName: kyc.fatherName,
      motherName: kyc.motherName,
      profession: kyc.profession,
      monthlyIncomeCents,
      patrimonyCents,
      addressCep: kyc.addressCep,
      addressStreet: kyc.addressStreet,
      addressNumber: kyc.addressNumber,
      addressComplement: kyc.addressComplement,
      addressCity: kyc.addressCity,
      addressState: kyc.addressState,
      phone: kyc.phone,
      email: kyc.email,
      maritalStatus: kyc.maritalStatus,
    });

    revalidatePath('/portal/planos');
    return {};
  } catch (e: unknown) {
    if (e instanceof PendingPlanRequestError) return { error: e.message };
    console.error('[submitKycAndPlanAction]', e);
    return { error: 'Erro ao enviar solicitação. Tente novamente.' };
  }
}

// ── Submit plan change request (existing user) ────────────────────────────────

export async function submitPlanChangeAction(formData: FormData): Promise<{ error?: string }> {
  const session = await authService.getCurrentAccessUser();
  if (!session) return { error: 'Sessão expirada. Faça login novamente.' };
  if (!(await allowPlanMutation(session.id, 'plan-change'))) {
    return { error: 'Muitas tentativas. Aguarde antes de enviar novamente.' };
  }

  const requestedPlan = String(formData.get('requested_plan') ?? '').trim() as PlanInterest;
  if (!['start', 'prime', 'elite'].includes(requestedPlan)) {
    return { error: 'Selecione um plano válido.' };
  }

  const monthlyInvestmentCents = parseNonnegativeBrlCents(
    formData.get('monthly_investment'),
    POSTGRES_INTEGER_MAX
  );
  if (monthlyInvestmentCents === null || monthlyInvestmentCents <= 0) {
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
      monthlyInvestmentCents,
    });

    revalidatePath('/portal/planos');
    return {};
  } catch (e: unknown) {
    if (e instanceof PendingPlanRequestError) return { error: e.message };
    console.error('[submitPlanChangeAction]', e);
    return { error: 'Erro ao enviar solicitação. Tente novamente.' };
  }
}
