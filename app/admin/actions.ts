'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  clearAdminLoginRateLimit,
  consumeAdminLoginGlobalRateLimit,
  consumeAdminLoginRateLimit,
  destroyAdminSession,
  requireAdmin,
} from '@/src/features/admin/admin.auth';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { getSessionContextFromHeaders } from '@/src/server/security/request';
import { PasswordHashBusyError } from '@/src/server/security/password';

// ── Auth / session ────────────────────────────────────────────────────────────

export async function adminLoginAction(formData: FormData): Promise<{ error?: string }> {
  const { validateAdminCredentials, createAdminSession } =
    await import('@/src/features/admin/admin.auth');
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '').normalize('NFC');

  if (!email || !password) {
    return { error: 'Preencha e-mail e senha.' };
  }
  if (Array.from(email.normalize('NFC')).length > 320 || Array.from(password).length > 128) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  const requestHeaders = await headers();
  const { ipAddress } = getSessionContextFromHeaders(requestHeaders);
  const accountRateLimitKey = `account:${email}`;
  const globalAllowed = await consumeAdminLoginGlobalRateLimit();
  if (!globalAllowed) {
    return { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' };
  }
  const [accountAllowed, addressAllowed] = await Promise.all([
    consumeAdminLoginRateLimit(accountRateLimitKey),
    !ipAddress ? Promise.resolve(true) : consumeAdminLoginRateLimit(`ip:${ipAddress}`),
  ]);
  if (!accountAllowed || !addressAllowed) {
    return { error: 'Muitas tentativas. Aguarde antes de tentar novamente.' };
  }

  let user;
  try {
    user = await validateAdminCredentials(email, password);
  } catch (error) {
    if (error instanceof PasswordHashBusyError) {
      return { error: 'Serviço de autenticação ocupado. Tente novamente em instantes.' };
    }
    throw error;
  }
  if (!user) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  await clearAdminLoginRateLimit(accountRateLimitKey);
  await createAdminSession(user);
  redirect('/admin');
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect('/admin/login');
}

// ── Saques ────────────────────────────────────────────────────────────────────

export async function approveWithdrawalAction(id: string) {
  const session = await requireAdmin(['master', 'financeiro']);

  await adminRepository.updateWithdrawalStatus(id, 'approved', session.email);
  revalidatePath('/admin/saques');
  revalidatePath('/admin/pix');
  // Revalida portal — saldo disponível depende do status dos saques
  revalidatePath('/portal', 'layout');
  revalidatePath('/portal/carteira');
  revalidatePath('/portal/cashback');
}

export async function rejectWithdrawalAction(id: string) {
  const session = await requireAdmin(['master', 'financeiro']);

  await adminRepository.updateWithdrawalStatus(id, 'rejected', session.email);
  revalidatePath('/admin/saques');
  revalidatePath('/admin/pix');
  // Revalida portal — saque rejeitado libera o bloqueio, saldo precisa atualizar
  revalidatePath('/portal', 'layout');
  revalidatePath('/portal/carteira');
  revalidatePath('/portal/cashback');
}

// ── Configurações (master only) ───────────────────────────────────────────────

async function requireMaster() {
  return requireAdmin(['master']);
}

function validateAdminPassword(password: string): string | null {
  const length = Array.from(password.normalize('NFC')).length;
  if (length < 15 || length > 128) {
    return 'A senha deve ter entre 15 e 128 caracteres.';
  }
  return null;
}

export async function updatePlanAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    const id = String(formData.get('id') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const monthlyCents = Math.round(parseFloat(String(formData.get('monthly_brl') ?? '0')) * 100);
    if (!id || !name || monthlyCents <= 0) return { error: 'Dados inválidos.' };
    await configRepository.updatePlan(id, name, monthlyCents);
    revalidatePath('/admin/configuracoes');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro.' };
  }
}

export async function updateCommissionConfigAction(
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.setCommissionConfig({
      direct_pct: parseFloat(String(formData.get('direct_pct') ?? '10')),
      level1_pct: parseFloat(String(formData.get('level1_pct') ?? '2')),
      level2_pct: parseFloat(String(formData.get('level2_pct') ?? '1')),
      level3_pct: parseFloat(String(formData.get('level3_pct') ?? '0.5')),
      level4_pct: parseFloat(String(formData.get('level4_pct') ?? '0')),
    });
    revalidatePath('/admin/configuracoes');
    // Revalida portal — comissões afetam dashboard e rede
    revalidatePath('/portal', 'layout');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro.' };
  }
}

export async function updateCashbackConfigAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.setCashbackConfig({
      standard_pct: parseFloat(String(formData.get('standard_pct') ?? '40')),
      premium_pct: parseFloat(String(formData.get('premium_pct') ?? '50')),
      premium_threshold_cents: Math.round(
        parseFloat(String(formData.get('premium_threshold_brl') ?? '10000')) * 100
      ),
      duration_months: parseInt(String(formData.get('duration_months') ?? '12')),
      credit_day: parseInt(String(formData.get('credit_day') ?? '16')),
    });
    revalidatePath('/admin/configuracoes');
    // Revalida portal — cashback global afeta dashboard e cashback do usuário
    revalidatePath('/portal', 'layout');
    revalidatePath('/portal/cashback');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro.' };
  }
}

export async function addAdminUserAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') ?? '').normalize('NFC');
    const role = String(formData.get('role') ?? 'suporte').trim();
    if (!name || !email || !password || !role) return { error: 'Preencha todos os campos.' };
    const passwordError = validateAdminPassword(password);
    if (passwordError) return { error: passwordError };
    await configRepository.addAdminUser(name, email, password, role);
    revalidatePath('/admin/configuracoes');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'E-mail já em uso ou dados inválidos.' };
  }
}

export async function updateAdminUserAction(formData: FormData): Promise<{ error?: string }> {
  try {
    await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    const id = String(formData.get('id') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();
    const password = String(formData.get('password') ?? '').normalize('NFC');
    const role = String(formData.get('role') ?? 'suporte').trim();
    const active = formData.get('active') === '1' ? 1 : 0;
    if (!id || !name || !email) return { error: 'Dados inválidos.' };
    if (password) {
      const passwordError = validateAdminPassword(password);
      if (passwordError) return { error: passwordError };
    }
    await configRepository.updateAdminUser(id, name, email, password || null, role, active === 1);
    revalidatePath('/admin/configuracoes');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro.' };
  }
}

export async function deleteAdminUserAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireMaster();
    if (id === session.id) return { error: 'Você não pode remover a si mesmo.' };
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.deleteAdminUser(id);
    revalidatePath('/admin/configuracoes');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro.' };
  }
}

// ── Plan request approval / rejection ────────────────────────────────────────

export async function approvePlanRequestAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin(['master', 'financeiro']);
    const { planRequestsRepository } =
      await import('@/src/features/plans/plan-requests.repository');
    await planRequestsRepository.approveRequest(id, session.name);
    revalidatePath('/admin/planos');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro ao aprovar.' };
  }
}

export async function rejectPlanRequestAction(
  id: string,
  note: string
): Promise<{ error?: string }> {
  try {
    const session = await requireAdmin(['master', 'financeiro']);
    const { planRequestsRepository } =
      await import('@/src/features/plans/plan-requests.repository');
    await planRequestsRepository.rejectRequest(id, session.name, note);
    revalidatePath('/admin/planos');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro ao rejeitar.' };
  }
}
