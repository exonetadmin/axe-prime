import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import { walletRepository } from '@/src/features/wallet/wallet.repository';

export const dynamic = 'force-dynamic';

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

type RealCommission = {
  id: string;
  referredName: string;
  type: string;
  level: number;
  amountCents: number;
  period: string;
  status: string;
  createdAt: string;
};

async function loadRealCommissions(userId: string): Promise<RealCommission[]> {
  const rows = await walletRepository.listCommissions(userId, 100);
  return rows.map((r) => ({
    id: r.id,
    referredName: r.referred_name,
    type: r.type,
    level: r.level ?? 0,
    amountCents: r.amount_cents ?? 0,
    period: r.period ?? '',
    status: r.status ?? 'available',
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : r.created_at,
  }));
}

export default async function PortalComissoesPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/auth');

  // Comissões ACUMULADAS (bruto) — mesmo valor em todas as telas. O saldo
  // líquido para saque fica exclusivamente na Carteira.
  const dashboard = await networkService.getDashboardSummary(user.id);
  const summary = dashboard.indicacoes;
  const rede = dashboard.rede;
  const realCommissions = await loadRealCommissions(user.id);

  const totalPaidCommissions = realCommissions.reduce((s, c) => s + c.amountCents, 0);

  return (
    <div className="portal-page static-stage">
      <section className="portal-shell">
        {/* ── Header ── */}
        <div className="com-header">
          <h1 className="portal-title com-title">Comissões</h1>
          <p className="com-subtitle">
            Acompanhe suas comissões por indicações diretas e pela rede.
          </p>
        </div>

        {/* ── Two summary cards ── */}
        <div className="com-grid">
          {/* Indicações Diretas */}
          <article className="com-card">
            <header className="com-card-head">
              <div className="com-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
              </div>
              <div>
                <span className="com-card-title">Indicações Diretas</span>
                <span className="com-card-pct">10% por 12 meses</span>
              </div>
            </header>
            <div className="com-card-body">
              <div className="com-value-row">
                <div className="com-value-block">
                  <span className="com-value" data-variant="green">{formatBRL(summary.disponivelCents)}</span>
                  <span className="com-value-label">Acumulado</span>
                </div>
                <div className="com-value-sep" />
                <div className="com-value-block">
                  <span className="com-value">{formatBRL(summary.aReceberCents)}</span>
                  <span className="com-value-label">A receber</span>
                </div>
              </div>
              <p className="com-note">
                A cada cashback mensal pago ao seu indicado, você recebe 10% da
                mensalidade dele. São 12 meses de comissão por indicação.
              </p>
            </div>
          </article>

          {/* Comissão da Rede */}
          <article className="com-card">
            <header className="com-card-head">
              <div className="com-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <div>
                <span className="com-card-title">Comissão da Rede</span>
                <span className="com-card-pct">{rede.percentualDesbloqueado}% / 8% máx</span>
              </div>
            </header>
            <div className="com-card-body">
              <div className="com-value-row">
                <div className="com-value-block">
                  <span className="com-value" data-variant="green">{formatBRL(rede.disponivelCents)}</span>
                  <span className="com-value-label">Acumulado</span>
                </div>
                <div className="com-value-sep" />
                <div className="com-value-block">
                  <span className="com-value">{rede.totalMembros}</span>
                  <span className="com-value-label">Membros na rede</span>
                </div>
              </div>
              <p className="com-note">
                2% por nível desbloqueado conforme sua posição na carreira.
                Suba de posição para desbloquear mais níveis (máximo 8%).
              </p>
              <div className="dash-progress-bar">
                <div
                  className="dash-progress-fill"
                  data-variant="rede"
                  style={{ width: `${(rede.percentualDesbloqueado / 8) * 100}%` }}
                />
              </div>
            </div>
          </article>
        </div>

        {/* ── Comissões Recebidas (Real) ── */}
        {realCommissions.length > 0 && (
          <article className="com-sales-card">
            <header className="com-sales-header">
              <span className="portal-kicker">Comissões recebidas</span>
              <span className="com-sales-count">
                {realCommissions.length} registros · Total: {formatBRL(totalPaidCommissions)}
              </span>
            </header>
            <div className="com-sales-list">
              {realCommissions.map((c) => {
                const typeLabel = c.type === 'direct'
                  ? `Direta (10%)`
                  : `Rede N${c.level} (2%)`;
                const statusColor = c.status === 'available'
                  ? 'var(--success)'
                  : c.status === 'paid'
                  ? 'var(--accent)'
                  : 'var(--text-soft)';
                const statusLabel = c.status === 'available'
                  ? 'Disponível'
                  : c.status === 'paid'
                  ? 'Pago'
                  : 'Sacado';
                const monthMatch = c.period.match(/cashback-m(\d+)/);
                const monthLabel = monthMatch ? `Mês ${monthMatch[1]}/12` : c.period;

                return (
                  <div key={c.id} className="com-sale-item">
                    <div className="com-sale-avatar">
                      {c.referredName.charAt(0).toUpperCase()}
                    </div>
                    <div className="com-sale-info">
                      <span className="com-sale-name">{c.referredName}</span>
                      <span className="com-sale-meta">
                        {typeLabel} · {monthLabel}
                      </span>
                    </div>
                    <div className="com-sale-values">
                      <span className="com-sale-month">{formatBRL(c.amountCents)}</span>
                      <span
                        className="com-sale-total"
                        style={{ color: statusColor, fontSize: '0.72rem', fontWeight: 600 }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        )}

        {/* ── Sales Projection ── */}
        {summary.salesWithProjection.length > 0 && (
          <article className="com-sales-card">
            <header className="com-sales-header">
              <span className="portal-kicker">Projeção de comissões</span>
              <span className="com-sales-count">{summary.salesWithProjection.length} indicados</span>
            </header>
            <div className="com-sales-list">
              {summary.salesWithProjection.map((sale) => (
                <div key={sale.referredUserId} className="com-sale-item">
                  <div className="com-sale-avatar">
                    {sale.referredName.charAt(0).toUpperCase()}
                  </div>
                  <div className="com-sale-info">
                    <span className="com-sale-name">{sale.referredName}</span>
                    <span className="com-sale-meta">
                      {sale.monthsPaid}/12 pagos · {sale.monthsRemaining} restantes
                    </span>
                    {/* Mini timeline */}
                    <div className="com-timeline" style={{ display: 'flex', gap: '3px', marginTop: '6px' }}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            width: '14px',
                            height: '4px',
                            borderRadius: '2px',
                            background: i < sale.monthsPaid
                              ? 'var(--success)'
                              : 'rgba(255,255,255,0.08)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="com-sale-values">
                    <span className="com-sale-month">
                      {formatBRL(sale.commissionPerMonthCents)}
                      <span className="com-sale-month-label">/mês</span>
                    </span>
                    <span className="com-sale-total">{formatBRL(sale.totalAReceberCents)} a receber</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        )}
      </section>
    </div>
  );
}
