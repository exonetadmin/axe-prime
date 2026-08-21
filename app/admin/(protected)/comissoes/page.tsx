import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import CommissionStatusButton from './commission-status-button';
import { BadgeDollarSign, ArrowRightLeft, GitBranch, ListFilter } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  direct: { label: 'Direto (N1)', color: 'var(--accent)' },
  network: { label: 'Rede (N2–N5)', color: '#a78bfa' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponível', color: 'var(--success)' },
  paid: { label: 'Pago', color: 'var(--accent)' },
  withdrawn: { label: 'Sacado', color: 'var(--text-soft)' },
};

const STATUS_TABS = [
  { key: 'all', label: 'Todos', icon: ListFilter },
  { key: 'available', label: 'Disponível', icon: BadgeDollarSign },
  { key: 'paid', label: 'Pago', icon: BadgeDollarSign },
  { key: 'withdrawn', label: 'Sacado', icon: ArrowRightLeft },
] as const;

type StatusFilter = 'available' | 'paid' | 'withdrawn' | 'all';

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = (sp.status ?? 'all') as StatusFilter;
  return (
    <AdminModuleGate module="comissoes" title="Comissões">
      <ComissoesContent statusFilter={statusFilter} />
    </AdminModuleGate>
  );
}

async function ComissoesContent({ statusFilter }: { statusFilter: StatusFilter }) {
  const [{ rows, total }, totalCents, byType] = await Promise.all([
    adminRepository.listCommissionsFiltered(statusFilter, 100, 0),
    adminRepository.totalCommissionsCents(),
    adminRepository.commissionsByType(),
  ]);

  return (
    <div className="adm-page">
      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Financeiro · Comissões MLM</p>
          <h1 className="adm-page-title">Comissões</h1>
          <p className="adm-page-sub">
            Total distribuído:{' '}
            <strong style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalCents)}
            </strong>
            <span style={{ marginLeft: '0.75rem', color: 'var(--text-soft)' }}>
              · {total} registros
            </span>
          </p>
        </div>
        <span
          className="adm-role-badge"
          style={{
            background: 'rgba(56,189,248,0.08)',
            borderColor: 'rgba(56,189,248,0.2)',
            color: 'var(--accent)',
          }}
        >
          <BadgeDollarSign size={12} strokeWidth={2} />
          {fmt(totalCents)}
        </span>
      </header>

      {/* ── Por tipo ── */}
      <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>
        {byType.map(t => {
          const meta = TYPE_META[t.type] ?? { label: t.type, color: 'var(--text-soft)' };
          return (
            <div key={t.type} className="adm-stat-card">
              <div
                className="adm-stat-icon"
                style={{ color: meta.color, borderColor: `${meta.color}22` }}
              >
                <GitBranch size={14} strokeWidth={1.8} />
              </div>
              <div className="adm-stat-body">
                <p className="adm-stat-value">{fmt(t.total)}</p>
                <p className="adm-stat-label">
                  {meta.label} · {t.count} reg.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="adm-tabs">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => (
          <a
            key={key}
            href={`/admin/comissoes?status=${key}`}
            className={`adm-tab${statusFilter === key ? ' adm-tab--active' : ''}`}
          >
            <Icon size={11} strokeWidth={2} />
            {label}
          </a>
        ))}
      </div>

      {/* ── Tabela ── */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Patrocinador</th>
              <th>Indicado</th>
              <th>Tipo</th>
              <th>Nível</th>
              <th>Valor</th>
              <th>Período</th>
              <th>Status</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="adm-table-empty">
                  Nenhuma comissão registrada.
                </td>
              </tr>
            ) : (
              rows.map(c => {
                const typeMeta = TYPE_META[c.type] ?? { label: c.type, color: 'var(--text-soft)' };
                const statusMeta = STATUS_META[c.status] ?? {
                  label: c.status,
                  color: 'var(--text-soft)',
                };
                return (
                  <tr key={c.id}>
                    <td data-label="Patrocinador" className="adm-table-name">
                      {c.sponsor_name}
                    </td>
                    <td data-label="Indicado" className="adm-table-muted">
                      {c.referred_name}
                    </td>
                    <td data-label="Tipo">
                      <span
                        className="adm-badge"
                        style={{ color: typeMeta.color, borderColor: `${typeMeta.color}28` }}
                      >
                        {typeMeta.label}
                      </span>
                    </td>
                    <td
                      data-label="Nível"
                      className="adm-table-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      N{c.level}
                    </td>
                    <td data-label="Valor" className="adm-table-value">
                      {fmt(c.amount_cents)}
                    </td>
                    <td
                      data-label="Período"
                      className="adm-table-muted"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {c.period}
                    </td>
                    <td data-label="Status">
                      <span
                        className="adm-badge"
                        style={{ color: statusMeta.color, borderColor: `${statusMeta.color}28` }}
                      >
                        {statusMeta.label}
                      </span>
                    </td>
                    <td data-label="Ação" style={{ textAlign: 'center' }}>
                      <CommissionStatusButton commissionId={c.id} currentStatus={c.status} />
                    </td>
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
