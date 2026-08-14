import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import { configRepository } from '@/src/features/admin/config.repository';
import type { CashbackSummary } from '@/src/features/network/network.contract';
import CashbackHero from '../cashback-hero';
import type { ChartDataPoint } from '../cashback-projection-chart';

export const dynamic = 'force-dynamic';

function formatPlan(plan: string | null): string {
  if (!plan) return 'Não informado';
  return (
    { start: 'Start', prime: 'Prime', elite: 'Elite' }[plan] ?? plan
  );
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(iso));
}

/** Build 12-month chart projection */
function buildChartData(cb: CashbackSummary): ChartDataPoint[] {
  const creditDate = new Date(cb.proximoCredito);
  const monthlyValue = cb.previstoMesCents / 100;

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(creditDate);
    d.setMonth(d.getMonth() + i);
    const monthShort = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const monthFull = `${monthShort.charAt(0).toUpperCase() + monthShort.slice(1)}/${d.getFullYear()}`;
    const label = monthShort.charAt(0).toUpperCase() + monthShort.slice(1, 3);

    return {
      month: label,
      monthFull,
      value: monthlyValue,
      paid: i < cb.mesesPagos,
    };
  });
}

function buildProjectionList(cb: CashbackSummary) {
  const creditDate = new Date(cb.proximoCredito);
  
  return Array.from({ length: cb.mesesRestantes }, (_, i) => {
    const d = new Date(creditDate);
    d.setMonth(d.getMonth() + i);
    
    return {
      id: `proj-${i}`,
      dateStr: formatDate(d.toISOString()),
      valueStr: formatBRL(cb.previstoMesCents),
      status: i === 0 ? 'Próximo' : 'Pendente'
    };
  });
}

export default async function CashbackPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/auth');
  }

  const [dashboard, cashCfg] = await Promise.all([
    networkService.getDashboardSummary(user.id),
    configRepository.getCashbackConfig(),
  ]);
  const cb = dashboard.cashback;
  const creditDay = cashCfg.credit_day;

  /* Cashback creditado (bruto) — mesmo valor mostrado na home e na carteira.
     O saldo líquido para saque fica só na Carteira. */
  const availCashbackCents = cb.disponivelCents;

  const chartData = buildChartData(cb);
  const projList = buildProjectionList(cb);

  return (
    <div className="portal-page static-stage">
      <section className="portal-shell">
        <CashbackHero
          planName={formatPlan(user.planInterest)}
          planTier={user.planInterest ?? 'start'}
          monthlyInvestment={formatBRL(cb.planMonthlyCents)}
          cashbackRate={cb.percentual}
          availableCashback={formatBRL(availCashbackCents)}
          remainingTotal={formatBRL(cb.totalPrevistoRestanteCents)}
          monthsRemaining={cb.mesesRestantes}
          nextCreditDate={formatDate(cb.proximoCredito).replace(/ de \d{4}/, '')}
          isActive={cb.ativo}
          chartData={chartData}
          mesesPagos={cb.mesesPagos}
          creditDay={creditDay}
        />

        <div className="dash-bento" style={{ marginTop: '2rem' }}>
          <header className="dash-bento-header">
            <h2>Projeção Detalhada</h2>
            <p className="subtitle">Acompanhe os próximos rendimentos programados no seu contrato.</p>
          </header>
          
          <div className="dash-card glaze">
            <div className="cb-projection" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projList.map((p, idx) => (
                <div key={p.id} className="cb-projection-card" style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-soft)' }}>
                      Parcela {cb.mesesPagos + idx + 1}/{12}
                    </span>
                    <strong style={{ fontSize: '1.125rem', color: 'var(--text)' }}>{p.valueStr}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-soft)' }}>{p.dateStr}</span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      background: p.status === 'Próximo' ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.05)',
                      color: p.status === 'Próximo' ? 'var(--sky)' : 'var(--text-soft)'
                    }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
              
              {projList.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-soft)' }}>
                  Nenhuma parcela pendente.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
