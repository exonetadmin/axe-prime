import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { configRepository } from '@/src/features/admin/config.repository';
import { Percent, CalendarClock, RefreshCw, TrendingUp, CheckCircle2 } from 'lucide-react';
import CashbackTable, { type CashbackRow } from './cashback-table';

export const dynamic = 'force-dynamic';

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default async function CashbackPage() {
  return (
    <AdminModuleGate module="cashback" title="Cashback">
      <CashbackContent />
    </AdminModuleGate>
  );
}

async function CashbackContent() {
  const [{ rows: rawRows, total }, cashCfg] = await Promise.all([
    adminRepository.listCashback(100, 0),
    configRepository.getCashbackConfig(),
  ]);
  const durationMonths = cashCfg.duration_months || 12;

  // Busca os meses efetivamente pagos de cada usuário
  const userIds = rawRows
    .filter(u => u.plan_monthly_cents)
    .map(u => u.id);
  const paidMap = await adminRepository.getCashbackPaymentsBulk(userIds);

  // Transforma para o formato da tabela
  const tableRows: CashbackRow[] = rawRows
    .filter(u => u.plan_monthly_cents)
    .map(u => {
      const monthly = u.plan_monthly_cents!;
      // Usa cashback_pct real do banco (definido pelo admin); fallback: config
      const pct = u.cashback_pct
        ?? (monthly >= (cashCfg.premium_threshold_cents || 1_000_000)
          ? (cashCfg.premium_pct || 50)
          : (cashCfg.standard_pct || 40));
      const cbMonth = Math.floor((monthly * pct) / 100);
      const paidMonths = paidMap[u.id] ?? [];

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        plan_interest: u.plan_interest,
        plan_monthly_cents: monthly,
        adhesion_at: u.adhesion_at ?? u.created_at,
        cashbackPct: pct,
        cbMonthCents: cbMonth,
        mesesPagos: paidMonths.length,
        mesesRestantes: durationMonths - paidMonths.length,
        totalPagoCents: paidMonths.length * cbMonth,
        paidMonths,
      };
    });

  // KPIs
  const totalPaidCents = tableRows.reduce((s, r) => s + r.paidMonths.length * r.cbMonthCents, 0);
  const totalPendenteCents = tableRows.reduce((s, r) => s + (durationMonths - r.paidMonths.length) * r.cbMonthCents, 0);
  const totalMesesPagos = tableRows.reduce((s, r) => s + r.paidMonths.length, 0);
  const totalMeses = tableRows.length * durationMonths;

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Financeiro · Programa de Cashback</p>
          <h1 className="adm-page-title">Cashback</h1>
          <p className="adm-page-sub">
            {total} participantes ·{' '}
            pago: <strong style={{ color: 'var(--success)' }}>{fmt(totalPaidCents)}</strong>
            {' · '}
            pendente: <strong style={{ color: '#fbbf24' }}>{fmt(totalPendenteCents)}</strong>
          </p>
        </div>
        <span className="adm-role-badge" style={{ background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.2)', color: 'var(--success)' }}>
          <Percent size={12} strokeWidth={2} />
          {total} ativos
        </span>
      </header>

      {/* ── KPIs ── */}
      <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: 'var(--success)', borderColor: 'rgba(52,211,153,0.2)' }}>
            <TrendingUp size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{fmt(totalPaidCents)}</p>
            <p className="adm-stat-label">Total pago</p>
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: '#fbbf24', borderColor: 'rgba(251,191,36,0.2)' }}>
            <CalendarClock size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{fmt(totalPendenteCents)}</p>
            <p className="adm-stat-label">A creditar (pendente)</p>
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.2)' }}>
            <RefreshCw size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{total}</p>
            <p className="adm-stat-label">Participantes ativos</p>
          </div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)' }}>
            <CheckCircle2 size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{totalMesesPagos}/{totalMeses}</p>
            <p className="adm-stat-label">Meses confirmados</p>
          </div>
        </div>
      </div>

      {/* ── Tabela interativa ── */}
      <CashbackTable rows={tableRows} />

      <p className="adm-table-meta">{total} participantes</p>
    </div>
  );
}
