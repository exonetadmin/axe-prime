import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import WithdrawalActions from './_withdrawal-actions';
import {
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  ListFilter,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_META = {
  pending:  { label: 'Pendente',  icon: Clock,         color: '#fbbf24' },
  approved: { label: 'Aprovado',  icon: CheckCircle2,  color: 'var(--success)' },
  rejected: { label: 'Rejeitado', icon: XCircle,       color: '#f87171' },
  all:      { label: 'Todos',     icon: ListFilter,    color: 'var(--text-soft)' },
} as const;

type StatusFilter = keyof typeof STATUS_META;

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const WITHDRAWAL_FEE = 0.06;

export default async function SaquesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = ((sp.status ?? 'pending') as StatusFilter);
  return (
    <AdminModuleGate module="saques" title="Saques">
      <SaquesContent statusFilter={statusFilter} />
    </AdminModuleGate>
  );
}

async function SaquesContent({ statusFilter }: { statusFilter: StatusFilter }) {
  const { rows, total } = await adminRepository.listWithdrawals(statusFilter, 100, 0);
  const pendingCount = statusFilter === 'all'
    ? (await adminRepository.listWithdrawals('pending', 999, 0)).total
    : undefined;

  const totalValue = rows.reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Financeiro · Saques</p>
          <h1 className="adm-page-title">Saques</h1>
          <p className="adm-page-sub">
            {total} solicitação{total !== 1 ? 'ões' : ''} ·{' '}
            volume: <strong style={{ color: 'var(--text)' }}>{fmt(totalValue)}</strong>
            {pendingCount != null && pendingCount > 0 && (
              <span style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
                · {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <span className="adm-role-badge" style={{ background: 'rgba(251,191,36,0.08)', borderColor: 'rgba(251,191,36,0.2)', color: '#fbbf24' }}>
          <ArrowDownToLine size={12} strokeWidth={2} />
          {total} saque{total !== 1 ? 's' : ''}
        </span>
      </header>

      {/* ── Filter tabs ── */}
      <div className="adm-tabs">
        {(Object.keys(STATUS_META) as StatusFilter[]).map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <a
              key={s}
              href={`/admin/saques?status=${s}`}
              className={`adm-tab${statusFilter === s ? ' adm-tab--active' : ''}`}
            >
              <Icon size={11} strokeWidth={2} />
              {meta.label}
            </a>
          );
        })}
      </div>

      {/* ── Tabela ── */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Membro</th>
              <th>Valor a Pagar</th>
              <th>Chave PIX</th>
              <th>Tipo</th>
              <th>Solicitado em</th>
              <th>Status</th>
              {statusFilter === 'pending' && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="adm-table-empty">
                  Nenhuma solicitação encontrada.
                </td>
              </tr>
            ) : (
              rows.map((w) => {
                const meta = STATUS_META[w.status as StatusFilter] ?? STATUS_META.pending;
                return (
                  <tr key={w.id}>
                    <td data-label="Membro">
                      <div className="adm-table-name">{w.user_name}</div>
                      <div className="adm-table-muted">{w.user_email}</div>
                    </td>
                    <td data-label="Valor a Pagar" className="adm-table-value">
                      <div>{fmt(Math.round(w.amount_cents * (1 - WITHDRAWAL_FEE)))}</div>
                      <div className="adm-table-muted" style={{ fontSize: '0.65rem' }}>Solicitado: {fmt(w.amount_cents)}</div>
                    </td>
                    <td data-label="Chave PIX">
                      <code className="adm-code">{w.pix_key}</code>
                    </td>
                    <td data-label="Tipo" className="adm-table-muted" style={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                      {w.pix_key_type}
                    </td>
                    <td data-label="Solicitado em" className="adm-table-muted">
                      {new Date(w.requested_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td data-label="Status">
                      <span className={`adm-badge adm-badge--${w.status}`} style={{ color: meta.color, borderColor: `${meta.color}30` }}>
                        {meta.label}
                      </span>
                    </td>
                    {statusFilter === 'pending' && (
                      <td data-label="Ações">
                        <WithdrawalActions id={w.id} />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="adm-table-meta">{total} registros · mostrando até 100</p>
    </div>
  );
}
