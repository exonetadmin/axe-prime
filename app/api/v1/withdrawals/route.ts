import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/src/features/auth';
import { walletRepository, WalletRuleError } from '@/src/features/wallet/wallet.repository';
import { authRateLimiter, type RateLimitPolicy } from '@/src/server/security/rate-limit';
import { hashOpaqueToken } from '@/src/server/security/tokens';
import {
  assertMutationSecurity,
  noStoreHeaders,
  parseJsonRequest,
  RequestSecurityError,
} from '@/src/server/security/request';

const requestSchema = z.object({
  amountCents: z.number().int().min(10_000).max(100_000_000),
});

const WITHDRAWAL_RATE_LIMITS = {
  global: { limit: 120, windowSeconds: 60, blockSeconds: 60 },
  user: { limit: 5, windowSeconds: 10 * 60, blockSeconds: 10 * 60 },
} satisfies Record<string, RateLimitPolicy>;

function idempotencyKey(request: Request): string | null {
  const value = request.headers.get('idempotency-key')?.trim() ?? '';
  return /^[A-Za-z0-9._~-]{16,128}$/.test(value) ? value : null;
}

async function enforceWithdrawalRateLimit(userId: string): Promise<NextResponse | null> {
  const globalDecision = await authRateLimiter.consume(
    'withdrawal-global',
    'all',
    WITHDRAWAL_RATE_LIMITS.global
  );
  const decision = globalDecision.allowed
    ? await authRateLimiter.consume('withdrawal-user', userId, WITHDRAWAL_RATE_LIMITS.user)
    : globalDecision;
  if (decision.allowed) return null;
  return NextResponse.json(
    { ok: false, message: 'Muitas solicitações de saque. Aguarde.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: { ...noStoreHeaders(), 'Retry-After': String(decision.retryAfterSeconds) },
    }
  );
}

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Não autenticado.' },
        {
          status: 401,
          headers: { ...noStoreHeaders(), 'WWW-Authenticate': 'Bearer realm="axe-prime-api"' },
        }
      );
    }

    const key = idempotencyKey(request);
    if (!key) {
      return NextResponse.json(
        { ok: false, message: 'Idempotency-Key obrigatório ou inválido.' },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const rateLimitResponse = await enforceWithdrawalRateLimit(user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const parsed = requestSchema.safeParse(await parseJsonRequest(request));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'O saque mínimo é R$ 100,00.' },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const fingerprint = createHash('sha256')
      .update(`withdrawal:v1\0${user.id}\0${parsed.data.amountCents}`, 'utf8')
      .digest('hex');
    const { netCents, replayed } = await walletRepository.createWithdrawal(
      user.id,
      parsed.data.amountCents,
      hashOpaqueToken(`withdrawal-idempotency:v1\0${key}`),
      fingerprint
    );

    revalidatePath('/portal/carteira');
    revalidatePath('/portal', 'layout');
    revalidatePath('/admin/saques');
    return NextResponse.json(
      {
        ok: true,
        message: `Saque de R$ ${(netCents / 100).toFixed(2)} solicitado! Aguardando aprovação.`,
      },
      { status: replayed ? 200 : 201, headers: noStoreHeaders() }
    );
  } catch (error) {
    if (error instanceof WalletRuleError) {
      const status =
        error.code === 'INVALID_AMOUNT' || error.code === 'INVALID_IDEMPOTENCY_KEY' ? 400 : 409;
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status, headers: noStoreHeaders() }
      );
    }
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status: error.status, headers: noStoreHeaders() }
      );
    }
    console.error('[POST /api/v1/withdrawals]', error);
    return NextResponse.json(
      { ok: false, message: 'Erro ao solicitar saque. Tente novamente.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
