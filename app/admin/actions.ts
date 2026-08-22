'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  type AdminLoginResult,
  clearAdminLoginRateLimit,
  consumeAdminLoginGlobalRateLimit,
  consumeAdminLoginRateLimit,
  createAdminMfaChallenge,
  createAdminSession,
  destroyAdminSession,
  requireAdmin,
  verifyAdminMfaChallenge,
} from '@/src/features/admin/admin.auth';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { getSessionContextFromHeaders } from '@/src/server/security/request';
import { PasswordHashBusyError } from '@/src/server/security/password';
import { validatePasswordPolicy } from '@/lib/password-policy';
import { tryRecordSecurityAuditEvent } from '@/src/server/security/audit-log';

// ── Auth / session ────────────────────────────────────────────────────────────

type AdminTotpLoginActionResult =
  | { ok: true; redirectTo: '/admin' }
  | { ok: false; error: string };

export async function adminLoginAction(formData: FormData): Promise<AdminLoginResult> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '').normalize('NFC');

  if (!email || !password) {
    return { ok: false, error: 'Preencha e-mail e senha.' };
  }
  if (Array.from(email.normalize('NFC')).length > 320 || Array.from(password).length > 128) {
    return { ok: false, error: 'E-mail ou senha inválidos.' };
  }

  const requestHeaders = await headers();
  const { ipAddress } = getSessionContextFromHeaders(requestHeaders);
  const accountRateLimitKey = `account:${email}`;
  const globalAllowed = await consumeAdminLoginGlobalRateLimit();
  if (!globalAllowed) {
    return { ok: false, error: 'Muitas tentativas. Aguarde antes de tentar novamente.' };
  }
  const [accountAllowed, addressAllowed] = await Promise.all([
    consumeAdminLoginRateLimit(accountRateLimitKey),
    !ipAddress ? Promise.resolve(true) : consumeAdminLoginRateLimit(`ip:${ipAddress}`),
  ]);
  if (!accountAllowed || !addressAllowed) {
    return { ok: false, error: 'Muitas tentativas. Aguarde antes de tentar novamente.' };
  }

  let user;
  try {
    const { validateAdminCredentials } = await import('@/src/features/admin/admin.auth');
    user = await validateAdminCredentials(email, password);
  } catch (error) {
    if (error instanceof PasswordHashBusyError) {
      return { ok: false, error: 'Serviço de autenticação ocupado. Tente novamente em instantes.' };
    }
    throw error;
  }
  if (!user) {
    await tryRecordSecurityAuditEvent({
      category: 'authentication',
      action: 'admin_login',
      outcome: 'failure',
      actorType: 'anonymous',
    });
    return { ok: false, error: 'E-mail ou senha inválidos.' };
  }

  await clearAdminLoginRateLimit(accountRateLimitKey);

  if (user.mfaEnabled) {
    let challengeToken;
    try {
      challengeToken = await createAdminMfaChallenge(user);
    } catch {
      return {
        ok: false,
        error: 'Não foi possível iniciar a validação em duas etapas. Tente novamente.',
      };
    }

    return {
      ok: false,
      requiresTotp: true,
      challengeToken,
      userName: user.name,
    };
  }

  await createAdminSession(user);
  await tryRecordSecurityAuditEvent({
    category: 'authentication',
    action: 'admin_login',
    outcome: 'success',
    actorType: 'admin',
    actorId: user.id,
  });

  return { ok: true, redirectTo: '/admin' };
}

export async function adminLoginTotpAction(formData: FormData): Promise<AdminTotpLoginActionResult> {
  const challengeToken = String(formData.get('challengeToken') ?? '').trim();
  const oneTimeCode = String(formData.get('token') ?? '').replace(/\s+/g, '');

  if (!challengeToken) return { ok: false, error: 'Sessão de validação inválida.' };
  if (!/^\d{6}$/.test(oneTimeCode)) return { ok: false, error: 'Informe o código de 6 dígitos.' };

  const tokenRateLimitKey = `mfa:${challengeToken}`;
  const allowed = await consumeAdminLoginRateLimit(tokenRateLimitKey);
  if (!allowed) {
    return { ok: false, error: 'Muitas tentativas de token. Tente novamente em instantes.' };
  }

  let user;
  try {
    user = await verifyAdminMfaChallenge(challengeToken, oneTimeCode);
  } catch {
    return { ok: false, error: 'Código inválido ou sessão expirada.' };
  }

  await createAdminSession(user);
  await tryRecordSecurityAuditEvent({
    category: 'authentication',
    action: 'admin_login_totp',
    outcome: 'success',
    actorType: 'admin',
    actorId: user.id,
  });

  return { ok: true, redirectTo: '/admin' };
}

type AdminTotpEnrollmentStartResult =
  | { ok: true; secret: string; otpauthUri: string }
  | { ok: false; error: string };

type AdminTotpEnrollmentConfirmResult = { ok: boolean; message: string; reauth?: boolean };

export async function startAdminTotpEnrollmentAction(
  _prev: AdminTotpEnrollmentStartResult | null,
  _formData: FormData
): Promise<AdminTotpEnrollmentStartResult> {
  void _prev;
  void _formData;
  try {
    const session = await requireAdmin();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    const result = await configRepository.initAdminTotpEnrollment(session.id);
    return { ok: true, secret: result.secret, otpauthUri: result.otpauthUri };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Não foi possível iniciar o cadastro.',
    };
  }
}

export async function confirmAdminTotpEnrollmentAction(
  _prev: AdminTotpEnrollmentConfirmResult | null,
  formData: FormData
): Promise<AdminTotpEnrollmentConfirmResult> {
  void _prev;
  const token = String(formData.get('token') ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(token)) {
    return { ok: false, message: 'Digite o código de 6 dígitos.' };
  }

  try {
    const session = await requireAdmin();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.enableAdminTotp(session.id, token);
    await destroyAdminSession();
    return {
      ok: true,
      message: 'Authenticator habilitado com sucesso. Faça login novamente.',
      reauth: true,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível validar o código.' };
  }
}

export async function disableAdminTotpAction(
  _prev: AdminTotpEnrollmentConfirmResult | null,
  formData: FormData
): Promise<AdminTotpEnrollmentConfirmResult> {
  void _prev;
  const confirmPhrase = String(formData.get('confirm') ?? '').trim();
  if (confirmPhrase.toLowerCase() !== 'desativar') {
    return { ok: false, message: 'Digite \"desativar\" para confirmar.' };
  }

  try {
    const session = await requireAdmin();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.disableAdminTotp(session.id);
    await destroyAdminSession();
    return {
      ok: true,
      message: 'Authenticator desativado com sucesso. Faça login novamente.',
      reauth: true,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível desativar o MFA.' };
  }
}

export async function adminLogoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect('/admin/login');
}

// ── Saques ────────────────────────────────────────────────────────────────────

export async function approveWithdrawalAction(id: string) {
  const session = await requireAdmin(['master', 'financeiro']);

  await adminRepository.updateWithdrawalStatus(id, 'approved', session.email, session.id);
  revalidatePath('/admin/saques');
  revalidatePath('/admin/pix');
  // Revalida portal — saldo disponível depende do status dos saques
  revalidatePath('/portal', 'layout');
  revalidatePath('/portal/carteira');
  revalidatePath('/portal/cashback');
}

export async function rejectWithdrawalAction(id: string) {
  const session = await requireAdmin(['master', 'financeiro']);

  await adminRepository.updateWithdrawalStatus(id, 'rejected', session.email, session.id);
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
  if (length > 128) {
    return 'A senha deve ter entre 8 e 128 caracteres.';
  }
  return validatePasswordPolicy(password);
}

export async function updatePlanAction(formData: FormData): Promise<{ error?: string }> {
  try {
    const session = await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    const id = String(formData.get('id') ?? '').trim();
    const name = String(formData.get('name') ?? '').trim();
    const monthlyCents = Math.round(parseFloat(String(formData.get('monthly_brl') ?? '0')) * 100);
    if (!id || !name || monthlyCents <= 0) return { error: 'Dados inválidos.' };
    await configRepository.updatePlan(id, name, monthlyCents, session.id);
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
    const session = await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.setCommissionConfig(
      {
        direct_pct: parseFloat(String(formData.get('direct_pct') ?? '10')),
        level1_pct: parseFloat(String(formData.get('level1_pct') ?? '2')),
        level2_pct: parseFloat(String(formData.get('level2_pct') ?? '1')),
        level3_pct: parseFloat(String(formData.get('level3_pct') ?? '0.5')),
        level4_pct: parseFloat(String(formData.get('level4_pct') ?? '0')),
      },
      session.id
    );
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
    const session = await requireMaster();
    const { configRepository } = await import('@/src/features/admin/config.repository');
    await configRepository.setCashbackConfig(
      {
        standard_pct: parseFloat(String(formData.get('standard_pct') ?? '40')),
        premium_pct: parseFloat(String(formData.get('premium_pct') ?? '50')),
        premium_threshold_cents: Math.round(
          parseFloat(String(formData.get('premium_threshold_brl') ?? '10000')) * 100
        ),
        duration_months: parseInt(String(formData.get('duration_months') ?? '12')),
        credit_day: parseInt(String(formData.get('credit_day') ?? '16')),
      },
      session.id
    );
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
    const session = await requireMaster();
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
    await configRepository.addAdminUser(name, email, password, role, session.id);
    revalidatePath('/admin/configuracoes');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'E-mail já em uso ou dados inválidos.' };
  }
}

export async function updateAdminUserAction(formData: FormData): Promise<{ error?: string }> {
  try {
    const session = await requireMaster();
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
    await configRepository.updateAdminUser(
      id,
      name,
      email,
      password || null,
      role,
      active === 1,
      session.id
    );
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
    await configRepository.deleteAdminUser(id, session.id);
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
    await planRequestsRepository.approveRequest(id, session.email, session.id);
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
    await planRequestsRepository.rejectRequest(id, session.email, session.id, note);
    revalidatePath('/admin/planos');
    return {};
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'Erro ao rejeitar.' };
  }
}
