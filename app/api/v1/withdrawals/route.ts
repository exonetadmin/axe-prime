import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/src/features/auth';
import { walletRepository, WalletRuleError } from '@/src/features/wallet/wallet.repository';
import {
  assertMutationSecurity,
  noStoreHeaders,
  parseJsonRequest,
  RequestSecurityError,
} from '@/src/server/security/request';

const requestSchema = z.object({
  amountCents: z.number().int().min(10_000).max(100_000_000),
});

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Não autenticado.' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const parsed = requestSchema.safeParse(await parseJsonRequest(request));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'O saque mínimo é R$ 100,00.' },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const { netCents } = await walletRepository.createWithdrawal(user.id, parsed.data.amountCents);

    revalidatePath('/portal/carteira');
    revalidatePath('/portal', 'layout');
    revalidatePath('/admin/saques');
    return NextResponse.json(
      {
        ok: true,
        message: `Saque de R$ ${(netCents / 100).toFixed(2)} solicitado! Aguardando aprovação.`,
      },
      { status: 201, headers: noStoreHeaders() }
    );
  } catch (error) {
    if (error instanceof WalletRuleError) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status: 409, headers: noStoreHeaders() }
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
