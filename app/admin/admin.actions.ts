'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes, randomUUID } from 'node:crypto';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { userRepository } from '@/src/features/auth/repositories/user.repository';
import { requireAdmin } from '@/src/features/admin/admin.auth';
import { hashPassword } from '@/src/server/security/password';

// ── Geração de referral_code AXE PRIME ──────────────────────────────────────

const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

async function generateReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = randomBytes(8);
    let suffix = '';
    for (let j = 0; j < 8; j++) suffix += REFERRAL_CHARS[(bytes[j] ?? 0) % REFERRAL_CHARS.length];
    const code = `AP-${suffix}`;
    const existing = await userRepository.findByReferralCode(code);
    if (!existing) return code;
  }
  const fallbackBytes = randomBytes(8);
  let fallbackSuffix = '';
  for (let index = 0; index < fallbackBytes.length; index++) {
    fallbackSuffix += REFERRAL_CHARS[(fallbackBytes[index] ?? 0) % REFERRAL_CHARS.length];
  }
  return `AP-${fallbackSuffix}`;
}

// ── createUserAction ─────────────────────────────────────────────────────────

export type CreateUserResult = { ok: boolean; message: string; referralCode?: string };

export async function createUserAction(
  _prev: CreateUserResult | null,
  formData: FormData
): Promise<CreateUserResult> {
  try {
    await requireAdmin(['master', 'suporte']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const password = ((formData.get('password') as string | null) ?? '').normalize('NFC');

  if (!name || name.length < 2)
    return { ok: false, message: 'Nome deve ter ao menos 2 caracteres.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, message: 'E-mail inválido.' };
  const passwordLength = Array.from(password).length;
  if (passwordLength < 15 || passwordLength > 128) {
    return { ok: false, message: 'A senha deve ter entre 15 e 128 caracteres.' };
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) return { ok: false, message: 'Este e-mail já está cadastrado.' };

  const passwordHash = await hashPassword(password);
  const referralCode = await generateReferralCode();

  await userRepository.create({
    id: randomUUID(),
    name,
    email,
    passwordHash,
    planInterest: null,
    sponsorId: null,
    referralCode,
    createdAt: new Date().toISOString(),
  });

  revalidatePath('/admin/usuarios');
  return { ok: true, message: 'Usuário criado com sucesso!', referralCode };
}

const VALID_PLANS = ['start', 'prime', 'elite', 'sem_plano'];

function parseCents(raw: string | null): number | null {
  if (!raw || raw.trim() === '') return null;
  // Formato PT-BR: separador de milhar = ".", decimal = ","
  // Ex: "1.932,60" → remove pontos → "1932,60" → troca vírgula por ponto → "1932.60"
  const cleaned = raw.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function updateUserPlanAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  if (!userId) return { ok: false, message: 'Usuário inválido.' };

  const plan = (formData.get('plan') as string | null)?.trim() ?? 'sem_plano';
  if (!VALID_PLANS.includes(plan)) return { ok: false, message: 'Plano inválido.' };

  const cashbackPctRaw = formData.get('cashbackPct') as string | null;
  const cashbackPct = parseInt(cashbackPctRaw ?? '40', 10);
  if (isNaN(cashbackPct) || cashbackPct < 0 || cashbackPct > 100) {
    return { ok: false, message: 'Cashback deve ser entre 0 e 100%.' };
  }

  const adhesionValueCents = parseCents(formData.get('adhesionValue') as string | null);
  const monthlyValueCents = parseCents(formData.get('monthlyValue') as string | null);

  try {
    await adminRepository.updateUserPlan(userId, {
      plan,
      cashbackPct,
      adhesionValueCents,
      monthlyValueCents,
    });

    // Revalida TUDO — admin + portal completo
    revalidatePath('/admin', 'layout');
    revalidatePath('/admin/usuarios');
    revalidatePath('/admin/cashback');
    revalidatePath('/admin/comissoes');
    revalidatePath('/admin/rede');
    revalidatePath('/admin/extrato');
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal');
    revalidatePath('/portal/planos');
    revalidatePath('/portal/saldo');
    revalidatePath('/portal/carreira');
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/comissoes');
    revalidatePath('/portal/carteira');
    return { ok: true, message: 'Dados salvos com sucesso. Comissões recalculadas.' };
  } catch (err) {
    console.error('[updateUserPlanAction]', err);
    return { ok: false, message: 'Erro ao salvar. Tente novamente.' };
  }
}

export async function toggleUserActiveAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master', 'suporte']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  const activeRaw = formData.get('active') as string | null;

  if (!userId) return { ok: false, message: 'Usuário inválido.' };

  const active = activeRaw === 'true';

  try {
    await userRepository.setActive(userId, active);
    revalidatePath('/admin/usuarios');
    // Revalida todo o portal (status ativo afeta carreira, saldo, cashback, rede)
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/carreira');
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/saldo');
    return {
      ok: true,
      message: active ? 'Acesso reativado com sucesso.' : 'Acesso desativado com sucesso.',
    };
  } catch (err) {
    console.error('[toggleUserActiveAction]', err);
    return { ok: false, message: 'Erro ao alterar status. Tente novamente.' };
  }
}

const VALID_CAREERS = ['vendedor_elite', 'supervisor', 'gestor', 'gerente_senior', 'diretor_geral'];

export async function updateCareerAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  if (!userId) return { ok: false, message: 'Usuário inválido.' };

  const career = (formData.get('career') as string | null)?.trim() ?? '';
  // '' ou 'sem_definicao' = remove a carreira manual (volta para cálculo automático)
  const finalCareer = career && VALID_CAREERS.includes(career) ? career : null;

  try {
    await adminRepository.updateUserCareer(userId, finalCareer);
    revalidatePath('/admin/usuarios');
    // Revalida todo o portal do membro para que a carreira reflita em todos os módulos
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/carreira');
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/saldo');
    return {
      ok: true,
      message: finalCareer ? 'Carreira atualizada.' : 'Carreira removida (automática).',
    };
  } catch (err) {
    console.error('[updateCareerAction]', err);
    return { ok: false, message: 'Erro ao salvar carreira.' };
  }
}

// ── Status de Pagamento ────────────────────────────────────────────────────────

export async function updateAdhesionPaidAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master', 'financeiro']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  if (!userId) return { ok: false, message: 'Usuário inválido.' };

  const raw = (formData.get('adhesion_paid') as string | null) ?? 'false';
  const paid = raw === 'true';

  try {
    await adminRepository.updateAdhesionPaid(userId, paid);
    revalidatePath('/admin/usuarios');
    revalidatePath('/admin/cashback');
    // Revalida portal — adesão afeta status ativo, cashback, carreira, dashboard
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/carreira');
    revalidatePath('/portal/saldo');
    return {
      ok: true,
      message: paid ? 'Adesão marcada como paga.' : 'Adesão marcada como não paga.',
    };
  } catch (err) {
    console.error('[updateAdhesionPaidAction]', err);
    return { ok: false, message: 'Erro ao salvar status da adesão.' };
  }
}

export async function updateMonthlyStatusAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master', 'financeiro']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  if (!userId) return { ok: false, message: 'Usuário inválido.' };

  const raw = formData.get('monthly_status') as string | null;
  const status = raw === 'paid' || raw === 'overdue' ? raw : null;

  try {
    await adminRepository.updateMonthlyStatus(userId, status);
    revalidatePath('/admin/usuarios');
    // Revalida portal — monthly_status afeta isActive() (rede, carreira, dashboard)
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/carreira');
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/saldo');
    return {
      ok: true,
      message:
        status === 'paid'
          ? 'Mensalidade marcada como paga.'
          : status === 'overdue'
            ? 'Mensalidade marcada como atrasada.'
            : 'Status da mensalidade limpo.',
    };
  } catch (err) {
    console.error('[updateMonthlyStatusAction]', err);
    return { ok: false, message: 'Erro ao salvar status da mensalidade.' };
  }
}

// ── Cashback Pagamento Mensal ──────────────────────────────────────────────────

export async function markCashbackMonthAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  let admin;
  try {
    admin = await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  const monthNum = parseInt((formData.get('monthNumber') as string) ?? '0', 10);
  const amountCents = parseInt((formData.get('amountCents') as string) ?? '0', 10);

  if (!userId) return { ok: false, message: 'Usuário inválido.' };
  if (monthNum < 1 || monthNum > 12) return { ok: false, message: 'Mês inválido (1-12).' };
  if (amountCents <= 0) return { ok: false, message: 'Valor inválido.' };

  try {
    await adminRepository.markCashbackMonthPaid(userId, monthNum, amountCents, admin.email);
    revalidatePath('/admin/cashback');
    revalidatePath('/admin/comissoes');
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal'); // dashboard principal
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/comissoes');
    revalidatePath('/portal/carteira');
    return { ok: true, message: `Mês ${monthNum} marcado como pago. Comissões geradas.` };
  } catch (err) {
    console.error('[markCashbackMonthAction]', err);
    return { ok: false, message: 'Erro ao registrar pagamento.' };
  }
}

export async function unmarkCashbackMonthAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const userId = (formData.get('userId') as string | null)?.trim();
  const monthNum = parseInt((formData.get('monthNumber') as string) ?? '0', 10);

  if (!userId) return { ok: false, message: 'Usuário inválido.' };
  if (monthNum < 1 || monthNum > 12) return { ok: false, message: 'Mês inválido.' };

  try {
    await adminRepository.unmarkCashbackMonthPaid(userId, monthNum);
    revalidatePath('/admin/cashback');
    revalidatePath('/admin/comissoes');
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal'); // dashboard principal
    revalidatePath('/portal/cashback');
    revalidatePath('/portal/comissoes');
    revalidatePath('/portal/carteira');
    return { ok: true, message: `Mês ${monthNum} desmarcado. Comissões removidas.` };
  } catch (err) {
    console.error('[unmarkCashbackMonthAction]', err);
    return { ok: false, message: 'Erro ao desmarcar pagamento.' };
  }
}

// ── Comissão: Marcar como Paga / Disponível ───────────────────────────────────

export async function markCommissionPaidAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const commissionId = (formData.get('commissionId') as string | null)?.trim();
  if (!commissionId) return { ok: false, message: 'Comissão inválida.' };

  try {
    await adminRepository.updateCommissionStatus(commissionId, 'paid');
    revalidatePath('/admin/comissoes');
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/comissoes');
    revalidatePath('/portal/carteira');
    return { ok: true, message: 'Comissão marcada como paga.' };
  } catch (err) {
    console.error('[markCommissionPaidAction]', err);
    return { ok: false, message: 'Erro ao atualizar comissão.' };
  }
}

export async function markCommissionAvailableAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await requireAdmin(['master']);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não autorizado.' };
  }

  const commissionId = (formData.get('commissionId') as string | null)?.trim();
  if (!commissionId) return { ok: false, message: 'Comissão inválida.' };

  try {
    await adminRepository.updateCommissionStatus(commissionId, 'available');
    revalidatePath('/admin/comissoes');
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/comissoes');
    revalidatePath('/portal/carteira');
    return { ok: true, message: 'Comissão revertida para disponível.' };
  } catch (err) {
    console.error('[markCommissionAvailableAction]', err);
    return { ok: false, message: 'Erro ao reverter comissão.' };
  }
}
