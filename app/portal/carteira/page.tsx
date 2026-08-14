import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import { supabase } from '@/lib/supabase';
import WalletClient from './wallet-client';

export const dynamic = 'force-dynamic';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type TxStatus = 'Concluído' | 'Pendente' | 'Rejeitado';
type TxType = 'withdrawal' | 'commission_direct' | 'commission_network' | 'cashback';

interface WalletTransaction {
  id: string;
  type: TxType;
  description: string;
  amountCents: number;
  direction: 'in' | 'out';
  status: TxStatus;
  date: string;
  sortKey: number; // timestamp for sorting
}

/* ── Data loaders ──────────────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

async function loadCashbackPayments(userId: string): Promise<WalletTransaction[]> {
  const { data } = await supabase
    .from('cashback_payments')
    .select('id, month_number, amount_cents, paid_at')
    .eq('user_id', userId)
    .order('paid_at', { ascending: false });

  return (data ?? []).map((r) => ({
    id: `cb-${r.id}`,
    type: 'cashback' as TxType,
    description: `Cashback mês ${r.month_number}/12`,
    amountCents: r.amount_cents ?? 0,
    direction: 'in' as const,
    status: 'Concluído' as TxStatus,
    date: fmtDate(r.paid_at),
    sortKey: new Date(r.paid_at).getTime(),
  }));
}

async function loadCommissions(userId: string): Promise<WalletTransaction[]> {
  const { data } = await supabase
    .from('commission_entries')
    .select('id, type, level, amount_cents, status, created_at, referred_user_id')
    .eq('sponsor_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data || data.length === 0) return [];

  // Busca nomes dos referidos para descrição
  const referredIds = [...new Set((data).map((r) => r.referred_user_id).filter(Boolean))];
  const nameMap: Record<string, string> = {};
  if (referredIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', referredIds);
    for (const u of (users ?? [])) {
      nameMap[u.id] = u.name?.split(' ')[0] ?? 'Parceiro';
    }
  }

  return (data).map((r) => {
    const isNetwork = r.type === 'network';
    const referredName = nameMap[r.referred_user_id] ?? 'Parceiro';
    const description = isNetwork
      ? `Comissão de Rede (N${r.level ?? 1}) · ${referredName}`
      : `Comissão Venda Direta · ${referredName}`;

    const txStatus: TxStatus = r.status === 'available' || r.status === 'paid' ? 'Concluído' : 'Pendente';

    return {
      id: `cm-${r.id}`,
      type: (isNetwork ? 'commission_network' : 'commission_direct') as TxType,
      description,
      amountCents: r.amount_cents ?? 0,
      direction: 'in' as const,
      status: txStatus,
      date: fmtDate(r.created_at),
      sortKey: new Date(r.created_at).getTime(),
    };
  });
}

async function loadWithdrawals(userId: string): Promise<WalletTransaction[]> {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select('id, amount_cents, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((r) => {
    const txStatus: TxStatus = r.status === 'approved'
      ? 'Concluído'
      : r.status === 'rejected'
        ? 'Rejeitado'
        : 'Pendente';
    return {
      id: `wd-${r.id}`,
      type: 'withdrawal' as TxType,
      description: r.status === 'rejected' ? 'Saque PIX · Rejeitado' : 'Saque PIX',
      amountCents: r.amount_cents ?? 0,
      direction: 'out' as const,
      status: txStatus,
      date: fmtDate(r.created_at),
      sortKey: new Date(r.created_at).getTime(),
    };
  });
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default async function CarteiraPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/auth');

  /* Saldo da carteira (tudo conferível, sem proporção):
     origens em BRUTO (creditado/acumulado) − já sacado = saldo disponível. */
  const balance = await networkService.getWalletBalance(user.id);
  const availableCents   = balance.availableCents;
  const cashbackCents    = balance.grossCashbackCents;
  const directSalesCents = balance.grossDirectCents;
  const networkCents     = balance.grossNetworkCents;
  const withdrawnCents   = balance.withdrawnCents;

  /* Load real transactions from database */
  const [cashbackTxs, commissionTxs, withdrawalTxs] = await Promise.all([
    loadCashbackPayments(user.id),
    loadCommissions(user.id),
    loadWithdrawals(user.id),
  ]);

  const allTransactions = [...cashbackTxs, ...commissionTxs, ...withdrawalTxs]
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ sortKey: _, ...tx }) => tx);

  // CPF gate
  const { data: userRow } = await supabase
    .from('users')
    .select('cpf')
    .eq('id', user.id)
    .maybeSingle();
  const hasCpf = !!(userRow?.cpf && String(userRow.cpf).replace(/\D/g, '').length === 11);

  return (
    <div className="portal-page static-stage">
      <section className="portal-shell">
        <header className="wlt-page-header">
          <p className="portal-kicker">Carteira</p>
          <h1 className="wlt-page-title">Seu extrato financeiro</h1>
          <p className="wlt-page-sub">
            Visualize saldo, origens e solicite saques com segurança.
          </p>
        </header>

        <WalletClient
          availableCents={availableCents}
          cashbackCents={cashbackCents}
          directSalesCents={directSalesCents}
          networkCents={networkCents}
          withdrawnCents={withdrawnCents}
          hasCpf={hasCpf}
          transactions={allTransactions}
        />
      </section>
    </div>
  );
}
