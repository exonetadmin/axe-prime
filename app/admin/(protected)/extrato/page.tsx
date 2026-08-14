import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { FileText, TrendingUp, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default async function ExtratoPage() {
  return (
    <AdminModuleGate module="extrato" title="Extrato da Empresa">
      <ExtratoContent />
    </AdminModuleGate>
  );
}

async function ExtratoContent() {
  const [totalRevenue, byPeriod, { rows }] = await Promise.all([
    adminRepository.totalRevenueCents(),
    adminRepository.paymentStatsByPeriod(),
    adminRepository.listPayments(50, 0),
  ]);

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Financeiro · Receita</p>
          <h1 className="adm-page-title">Extrato da Empresa</h1>
          <p className="adm-page-sub">
            Receita total acumulada:{' '}
            <strong style={{ color: 'var(--sky)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(totalRevenue)}
            </strong>
          </p>
        </div>
        <span className="adm-role-badge" style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.2)', color: 'var(--sky)' }}>
          <TrendingUp size={12} strokeWidth={2} />
          {fmt(totalRevenue)}
        </span>
      </header>

      {/* ── Resumo por período ── */}
      <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>
        {byPeriod.length === 0 && (
          <div className="adm-stat-card">
            <div className="adm-stat-icon" style={{ color: 'var(--text-soft)', borderColor: 'var(--border)' }}>
              <Calendar size={14} strokeWidth={1.8} />
            </div>
            <div className="adm-stat-body">
              <p className="adm-stat-value">R$ 0,00</p>
              <p className="adm-stat-label">Nenhum pagamento</p>
            </div>
          </div>
        )}
        {byPeriod.map((p, i) => (
          <div key={p.period} className="adm-stat-card">
            <div className="adm-stat-icon" style={{
              color: i === 0 ? 'var(--accent)' : 'var(--sky)',
              borderColor: i === 0 ? 'rgba(56,189,248,0.2)' : 'rgba(125,211,252,0.15)',
            }}>
              <Calendar size={14} strokeWidth={1.8} />
            </div>
            <div className="adm-stat-body">
              <p className="adm-stat-value">{fmt(p.total)}</p>
              <p className="adm-stat-label">{p.period} · {p.count} pag.</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabela de pagamentos ── */}
      <div className="adm-section-head">
        <FileText size={12} strokeWidth={2} className="adm-section-head-icon" />
        Pagamentos recentes
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Membro</th>
              <th>Valor</th>
              <th>Período</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="adm-table-empty">
                  Nenhum pagamento registrado ainda.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id}>
                  <td data-label="Membro" className="adm-table-name">{p.user_name}</td>
                  <td data-label="Valor" className="adm-table-value">{fmt(p.amount_cents)}</td>
                  <td data-label="Período" className="adm-table-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.period}</td>
                  <td data-label="Data" className="adm-table-muted">
                    {new Date(p.paid_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="adm-table-meta">{rows.length} registros · mostrando últimos 50</p>
    </div>
  );
}
