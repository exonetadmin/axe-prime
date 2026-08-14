import CashbackProjectionChart, {
  type ChartDataPoint,
} from './cashback-projection-chart';

/* ═══════════════════════════════════════════════════
   CashbackHero — Reusable Hero Section
   ─────────────────────────────────────────────────
   Pure presentation. ALL business data via props.
   Back-end plugs values from the API response —
   no HTML/CSS rewrite needed.
   ═══════════════════════════════════════════════════ */

export interface CashbackHeroProps {
  /** Plan name to display in the badge (e.g. "Prime", "Start") */
  planName: string;
  /** Plan tier slug for styling (e.g. "prime", "start") */
  planTier: string;
  /** Monthly investment/aporte — formatted string (e.g. "R$ 10.000,00") */
  monthlyInvestment: string;
  /** Cashback percentage applied (e.g. 50) */
  cashbackRate: number;
  /** Available cashback — formatted string (e.g. "R$ 5.000,00") */
  availableCashback: string;
  /** Remaining total — formatted string (e.g. "R$ 55.000,00") */
  remainingTotal: string;
  /** How many months of cashback remain */
  monthsRemaining: number;
  /** Next credit date — formatted string (e.g. "16 de abr.") */
  nextCreditDate: string;
  /** Whether the user has an active contract */
  isActive: boolean;
  /** Chart data — array of 12 monthly projections */
  chartData: ChartDataPoint[];
  /** How many months have already been paid (for chart coloring) */
  mesesPagos: number;
  /** Day of month for credit (from config) */
  creditDay?: number;
}

export default function CashbackHero({
  planName,
  planTier,
  monthlyInvestment,
  cashbackRate,
  availableCashback,
  remainingTotal,
  monthsRemaining,
  nextCreditDate,
  isActive,
  chartData,
  creditDay,
}: CashbackHeroProps) {
  return (
    <div className="dash-hero">
      {/* Part 1 — Contract Header */}
      <header className="dash-hero-contract">
        <span className="dash-tier-badge" data-tier={planTier}>
          {planName}
        </span>
        <div className="dash-hero-contract-details">
          <span>
            Aporte: <strong>{isActive ? monthlyInvestment : 'Pendente'}</strong>
            /mês
          </span>
          <span className="dash-hero-divider">·</span>
          <span>
            Cashback: <strong>{cashbackRate}%</strong>
          </span>
          <span className="dash-hero-divider">·</span>
          <span>
            Próximo crédito:{' '}
            <strong>{isActive ? nextCreditDate : '—'}</strong>
          </span>
        </div>
      </header>

      {/* Part 2 — Big Balance */}
      <div className="dash-hero-balance">
        <span className="dash-hero-label">Cashback Creditado</span>
        <span className="dash-hero-value">{availableCashback}</span>
        <p className="dash-hero-remaining">
          Total a receber nos próximos {monthsRemaining} meses:{' '}
          <strong>{remainingTotal}</strong>
        </p>
      </div>

      {/* Part 3 — Projection Chart */}
      <div className="dash-hero-chart-section">
        <span className="dash-hero-chart-title">
          Projeção de Retorno · 12 meses
        </span>
        <CashbackProjectionChart data={chartData} creditDay={creditDay} />
      </div>
    </div>
  );
}
