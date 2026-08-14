'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { networkService } from '@/src/features/network';

// ── Solicitar Saque PIX ───────────────────────────────────────────────────────

const WITHDRAWAL_FEE = 0.06;
const MIN_WITHDRAWAL = 100_00; // cents

export async function requestWithdrawalAction(
  amountCents: number
): Promise<{ ok: boolean; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };

  // Validação de valor
  if (!amountCents || amountCents < MIN_WITHDRAWAL) {
    return { ok: false, message: `Valor mínimo: R$ ${(MIN_WITHDRAWAL / 100).toFixed(2)}` };
  }

  // Verifica CPF
  const { data: userRow } = await supabase
    .from('users')
    .select('cpf')
    .eq('id', user.id)
    .maybeSingle();

  const cpf = userRow?.cpf ? String(userRow.cpf).replace(/\D/g, '') : '';
  if (cpf.length !== 11) {
    return { ok: false, message: 'Cadastre seu CPF antes de solicitar saque.' };
  }

  // Saldo real: MESMA fonte única de verdade das telas (ganhos − saques não
  // rejeitados). Garante que a validação nunca diverge do que o usuário vê.
  const { availableCents: realAvailable } = await networkService.getWalletBalance(user.id);

  if (amountCents > realAvailable) {
    return { ok: false, message: 'Saldo insuficiente.' };
  }

  // Calcular taxa
  const feeCents = Math.round(amountCents * WITHDRAWAL_FEE);
  const netCents = amountCents - feeCents;

  // Insere no banco (apenas colunas que existem)
  const { error } = await supabase.from('withdrawal_requests').insert({
    id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: user.id,
    amount_cents: amountCents,
    pix_key: cpf,
    status: 'pending',
  });

  if (error) {
    console.error('[requestWithdrawalAction] insert error:', error);
    return { ok: false, message: 'Erro ao solicitar saque. Tente novamente.' };
  }

  // Revalida carteira e admin
  revalidatePath('/portal/carteira');
  revalidatePath('/portal', 'layout');
  revalidatePath('/admin/saques');

  return {
    ok: true,
    message: `Saque de R$ ${(netCents / 100).toFixed(2)} solicitado! Aguardando aprovação.`,
  };
}
