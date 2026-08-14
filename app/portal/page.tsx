import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import { configRepository } from '@/src/features/admin/config.repository';
import type { CashbackSummary } from '@/src/features/network/network.contract';
import { siteUrl } from '@/lib/site-content';
import CashbackHero from './cashback-hero';
import HomeReferralCard from './home-referral-card';
import HomeContractedCredit from './home-contracted-credit';
import type { ChartDataPoint } from './cashback-projection-chart';

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
  }).format(new Date(iso));
}

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

export default async function PortalPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/auth');

  const [dashboard, cashCfg, commCfg] = await Promise.all([
    networkService.getDashboardSummary(user.id),
    configRepository.getCashbackConfig(),
    configRepository.getCommissionConfig(),
  ]);
  const { cashback, indicacoes, rede } = dashboard;
  const creditDay = cashCfg.credit_day;
  const durationMonths = cashCfg.duration_months || 12;
  const directPct = commCfg.direct_pct;
  const maxNetworkPct = commCfg.level1_pct + commCfg.level2_pct + commCfg.level3_pct + commCfg.level4_pct + commCfg.level5_pct;

  /* Valores por origem = CREDITADO/ACUMULADO (bruto), iguais em todas as telas.
     O saldo líquido para saque fica exclusivamente na Carteira. */
  const availCashbackCents = cashback.disponivelCents;
  const availDirectCents   = indicacoes.disponivelCents;
  const availNetCents      = rede.disponivelCents;

  const chartData = buildChartData(cashback);

  const referralCode = (user.referralCode ?? '').trim();
  const referralUrl = referralCode
    ? `${siteUrl}/auth?ref=${encodeURIComponent(referralCode)}`
    : '';

  return (
    <div className="portal-page static-stage">
      <section className="portal-shell">

        {/* ── Saldo de Crédito Contratado (estilo banco) ── */}
        <HomeContractedCredit
          adhesionValueCents={user.adhesionValueCents ?? null}
          planName={formatPlan(user.planInterest)}
          planTier={user.planInterest}
          cashbackMonthlyCents={cashback.previstoMesCents}
        />

        {/* ── Card de Indicação (link + copiar código) — topo ── */}
        <HomeReferralCard url={referralUrl} code={referralCode} />

        {/* ── Hero ── */}
        <CashbackHero
          planName={formatPlan(user.planInterest)}
          planTier={user.planInterest ?? 'start'}
          monthlyInvestment={formatBRL(cashback.planMonthlyCents)}
          cashbackRate={cashback.percentual}
          availableCashback={formatBRL(availCashbackCents)}
          remainingTotal={formatBRL(cashback.totalPrevistoRestanteCents)}
          monthsRemaining={cashback.mesesRestantes}
          nextCreditDate={formatDate(cashback.proximoCredito)}
          isActive={cashback.ativo}
          chartData={chartData}
          mesesPagos={cashback.mesesPagos}
          creditDay={creditDay}
        />


        {/* ── 3 Dashboard Cards ── */}
        <div className="dash-grid">

          {/* 💰 Cashback do Investimento */}
          <article className="dash-card dash-card-cashback">
            <header className="dash-card-head">
              <span className="dash-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              <span className="dash-card-label">Cashback do Investimento</span>
            </header>

            <div className="dash-card-body">
              <div className="cb-contract-row">
                <span className="cb-contract-label">Plano Atual</span>
                <span
                  className="cb-contract-plan-badge"
                  data-tier={user.planInterest ?? 'none'}
                >
                  {formatPlan(user.planInterest)}
                </span>
              </div>

              <div className="cb-contract-divider" />

              <div className="cb-contract-row">
                <span className="cb-contract-label">Aporte Mensal</span>
                <span className="cb-contract-value-main">
                  {formatBRL(cashback.planMonthlyCents)}
                </span>
              </div>

              <div className="cb-contract-divider" />

              <div className="cb-contract-row">
                <span className="cb-contract-label">Taxa / Retorno</span>
                <span className="cb-contract-value">
                  {cashback.percentual}%
                  <span className="cb-contract-value-suffix">
                    {' '}({formatBRL(cashback.previstoMesCents)}/mês)
                  </span>
                </span>
              </div>

              <div className="cb-contract-divider" />

              <div className="cb-contract-row">
                <span className="cb-contract-label">Próximo Pagamento</span>
                <span className="cb-contract-value cb-contract-value-muted">
                  {(() => {
                    try {
                      return new Intl.DateTimeFormat('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }).format(new Date(cashback.proximoCredito));
                    } catch {
                      return '16 de abril de 2026';
                    }
                  })()}
                </span>
              </div>
            </div>

            <a href="/portal/cashback" className="dash-card-link">
              Ver detalhes
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </article>

          {/* 🤝 Comissão de Indicações */}
          <article className="dash-card dash-card-indicacoes">
            <header className="dash-card-head">
              <span className="dash-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </span>
              <span className="dash-card-label">Comissão de Indicações</span>
            </header>
            <div className="dash-card-body">
              <div className="dash-pct-badge">{directPct}%</div>
              <div className="dash-values-row">
                <div className="dash-value-block">
                  <span className="dash-value-num" data-variant="green">
                    {formatBRL(availDirectCents)}
                  </span>
                  <span className="dash-value-label">Acumulado</span>
                </div>
                <div className="dash-value-divider" />
                <div className="dash-value-block">
                  <span className="dash-value-num">
                    {formatBRL(indicacoes.aReceberCents)}
                  </span>
                  <span className="dash-value-label">Previsto</span>
                </div>
                <div className="dash-value-divider" />
                <div className="dash-value-block">
                  <span className="dash-value-num" data-variant="soft">
                    {indicacoes.salesWithProjection.length}
                  </span>
                  <span className="dash-value-label">Indicados</span>
                </div>
              </div>
              <div className="dash-card-meta">
                <span>{directPct}% sobre cada indicado por {durationMonths} meses</span>
                <span>Creditado no mesmo dia da confirmação de pagamento</span>
              </div>
            </div>
            <a href="/portal/comissoes" className="dash-card-link">
              Ver comissões
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </article>

          {/* 🌐 Comissão da Rede */}
          <article className="dash-card dash-card-rede">
            <header className="dash-card-head">
              <span className="dash-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </span>
              <span className="dash-card-label">Comissão da Rede</span>
            </header>
            <div className="dash-card-body">
              <div className="dash-pct-badge">{rede.percentualDesbloqueado}%<span className="dash-pct-max"> / 8%</span></div>
              <div className="dash-values-row">
                <div className="dash-value-block">
                  <span className="dash-value-num" data-variant="green">
                    {formatBRL(availNetCents)}
                  </span>
                  <span className="dash-value-label">Acumulado</span>
                </div>
                <div className="dash-value-divider" />
                <div className="dash-value-block">
                  <span className="dash-value-num">
                    {formatBRL(rede.previstoTotalCents)}
                  </span>
                  <span className="dash-value-label">Previsto</span>
                </div>
                <div className="dash-value-divider" />
                <div className="dash-value-block">
                  <span className="dash-value-num" data-variant="soft">
                    {rede.totalMembros}
                  </span>
                  <span className="dash-value-label">Membros</span>
                </div>
              </div>
              <div className="dash-card-meta">
                <span>Comissão de rede por nível desbloqueado (máx {maxNetworkPct}%)</span>
                <span>Suba de posição para desbloquear mais níveis</span>
              </div>
              <div className="dash-progress-bar">
                <div
                  className="dash-progress-fill"
                  data-variant="rede"
                  style={{ width: `${maxNetworkPct > 0 ? (rede.percentualDesbloqueado / maxNetworkPct) * 100 : 0}%` }}
                />
              </div>
            </div>
            <a href="/portal/rede" className="dash-card-link">
              Ver rede
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </a>
          </article>
        </div>
      </section>
    </div>
  );
}
