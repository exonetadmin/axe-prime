"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Check, Dot, X } from "lucide-react";

import {
  calculateSimulation,
  clampInvestmentValue,
  formatCurrency,
  simulatorComparisonRows,
  simulatorPlans,
  simulatorRates,
  type CashbackRate,
  type ComparisonValue,
  type SimulatorPlanId,
} from "@/lib/investment-simulator";

type RangeStyle = CSSProperties & {
  "--range-progress": string;
};

const simulatorPlanOrder: SimulatorPlanId[] = ["start", "prime"];
const chartWidth = 640;
const chartHeight = 252;
const chartPadding = { top: 22, right: 20, bottom: 36, left: 20 };

function renderDesktopComparisonValue(value: ComparisonValue) {
  if (typeof value === "boolean") {
    return (
      <span
        className={`simulator-comparison-bool${value ? " is-true" : " is-false"}`}
        role="img"
        aria-label={value ? "Sim" : "Não"}
      >
        {value ? <Check size={18} strokeWidth={2.2} /> : <X size={18} strokeWidth={2.2} />}
      </span>
    );
  }

  return <span>{value}</span>;
}

function renderMobileComparisonValue(value: ComparisonValue) {
  if (typeof value === "boolean") {
    return (
      <span className={`simulator-mobile-value${value ? " is-true" : " is-false"}`}>
        {value ? "Sim" : "Não"}
      </span>
    );
  }

  return <span className="simulator-mobile-value">{value}</span>;
}

export default function InvestmentSimulator() {
  const [selectedPlan, setSelectedPlan] = useState<SimulatorPlanId>("prime");
  const [selectedRate, setSelectedRate] = useState<CashbackRate>(50);
  const [investmentValue, setInvestmentValue] = useState(simulatorPlans.prime.minimumInvestment);
  const [activeMonthIndex, setActiveMonthIndex] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lineProgress, setLineProgress] = useState(1); // 0 a 1 (percentual da linha), começa completo

  // Animação automática mês a mês - linha cresce suavemente com o círculo
  const animateChart = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setLineProgress(0);
    
    const months = 12;
    const duration = 6000; // duração total da animação em ms (6 segundos)
    const stepDuration = duration / months;
    
    let currentMonth = 0;
    
    const animate = () => {
      if (currentMonth <= months) {
        setActiveMonthIndex(currentMonth === months ? null : currentMonth);
        setLineProgress(currentMonth / months);
        currentMonth++;
        
        if (currentMonth <= months) {
          setTimeout(animate, stepDuration);
        } else {
          setIsAnimating(false);
          setLineProgress(1); // linha completa
          setActiveMonthIndex(null); // remove o destaque ao final
        }
      }
    };
    
    animate();
  }, [isAnimating]);

  // Animação na abertura do componente
  useEffect(() => {
    const timer = setTimeout(() => {
      animateChart();
    }, 800); // delay inicial de 800ms
    
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Garante que a linha fique completa quando não estiver animando
  useEffect(() => {
    if (!isAnimating) {
      setLineProgress(1);
    }
  }, [isAnimating]);

  // Animação quando o valor do investimento muda
  const handleInvestmentChange = useCallback((value: number) => {
    setInvestmentValue(value);
    // Reinicia a animação após um pequeno delay
    setTimeout(() => {
      animateChart();
    }, 300);
  }, [animateChart]);

  // Handler para mudança de plano com animação
  const handlePlanChange = useCallback((planId: SimulatorPlanId) => {
    const nextPlan = simulatorPlans[planId];
    setSelectedPlan(planId);
    setInvestmentValue(current =>
      current >= nextPlan.minimumInvestment && current <= nextPlan.maximumInvestment
        ? current
        : nextPlan.minimumInvestment,
    );
    // Dispara animação após mudança de plano
    setTimeout(() => {
      animateChart();
    }, 400);
  }, [animateChart]);

  const plan = simulatorPlans[selectedPlan];

  const simulation = calculateSimulation(selectedPlan, selectedRate, investmentValue);
  const maxAccumulated = simulation.months[simulation.months.length - 1]?.accumulatedReturn ?? 0;
  const sliderProgress =
    ((simulation.investmentValue - plan.minimumInvestment) /
      (plan.maximumInvestment - plan.minimumInvestment)) *
    100;
  const rangeStyle = {
    "--range-progress": `${Number.isFinite(sliderProgress) ? sliderProgress : 0}%`,
  } as RangeStyle;
  const drawableWidth = chartWidth - chartPadding.left - chartPadding.right;
  const drawableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartPoints = simulation.months.map((month, index) => {
    const x =
      chartPadding.left + (drawableWidth / Math.max(simulation.months.length - 1, 1)) * index;
    const y =
      chartPadding.top +
      drawableHeight * (1 - month.accumulatedReturn / Math.max(maxAccumulated, 1));

    return {
      month,
      x,
      y,
    };
  });
  // Path completo da linha
  const areaPath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const linePath = areaPath;
  const filledAreaPath = `${areaPath} L ${chartWidth - chartPadding.right} ${
    chartHeight - chartPadding.bottom
  } L ${chartPadding.left} ${chartHeight - chartPadding.bottom} Z`;
  
  // Comprimento total do path (para animação stroke-dasharray)
  const pathLength = chartPoints.length > 1 
    ? chartPoints.reduce((acc, point, i) => {
        if (i === 0) return 0;
        const prev = chartPoints[i - 1];
        return acc + Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2));
      }, 0)
    : 0;
  const guideLines = Array.from({ length: 4 }, (_, index) => {
    const position = chartPadding.top + (drawableHeight / 3) * index;
    return position;
  });
  const safeActiveMonthIndex =
    activeMonthIndex === null ? chartPoints.length - 1 : Math.min(activeMonthIndex, chartPoints.length - 1);
  const activePoint = chartPoints[safeActiveMonthIndex] ?? chartPoints[chartPoints.length - 1];
  const activeMonth = activePoint?.month ?? simulation.months[simulation.months.length - 1];

  function handleChartMove(event: MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const normalizedX = bounds.width > 0 ? relativeX / bounds.width : 0;
    const nextIndex = Math.round(normalizedX * (simulation.months.length - 1));
    setActiveMonthIndex(nextIndex);
  }

  return (
    <div className="simulator-stack">
      <div className="simulator-plan-switch" role="tablist" aria-label="Seleção de plano">
        {simulatorPlanOrder.map(planId => {
          const item = simulatorPlans[planId];
          const isActive = selectedPlan === planId;

          return (
            <button
              key={planId}
              id={`simulator-tab-${planId}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`simulator-panel-${planId}`}
              className={`simulator-plan-tab${isActive ? " is-active" : ""}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handlePlanChange(planId)}
            >
              <span className="simulator-plan-tab-title">{item.tabLabel}</span>
              <span className="simulator-plan-tab-note">{item.tabNote}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`simulator-panel-${selectedPlan}`}
        role="tabpanel"
        aria-labelledby={`simulator-tab-${selectedPlan}`}
        className="simulator-workbench"
      >
        <div className="simulator-controls-stack">
          <article className="simulator-panel shell-panel simulator-investment-panel">
            <span className="section-label">Valor do investimento</span>
            <div className="simulator-investment-display">
              {formatCurrency(simulation.investmentValue, 0)}
            </div>
            <div className="simulator-range-wrap">
              <input
                type="range"
                min={plan.minimumInvestment}
                max={plan.maximumInvestment}
                step={10}
                value={simulation.investmentValue}
                className="simulator-range"
                style={rangeStyle}
                aria-label={`Valor do investimento do plano ${plan.name}`}
                onChange={event =>
                  handleInvestmentChange(clampInvestmentValue(selectedPlan, Number(event.target.value)))
                }
              />
              <div className="simulator-range-scale">
                <span>{formatCurrency(plan.minimumInvestment)}</span>
                <span>{formatCurrency(plan.maximumInvestment)}</span>
              </div>
            </div>
          </article>

          <article className="simulator-panel shell-panel simulator-rate-panel">
            <span className="section-label">Percentual de cashback mensal</span>
            <div className="simulator-rate-value">
              <strong>{selectedRate}%</strong>
              <span>ao mês</span>
            </div>
            <div className="simulator-rate-options" role="group" aria-label="Percentual de cashback">
              {simulatorRates.map(rate => (
                <button
                  key={rate}
                  type="button"
                  className={`simulator-rate-chip${selectedRate === rate ? " is-active" : ""}`}
                  aria-pressed={selectedRate === rate}
                  onClick={() => setSelectedRate(rate)}
                >
                  {rate}%
                </button>
              ))}
            </div>
            <p className="simulator-rate-note">
              Plano {plan.name}: até {plan.maxCashbackRate}% de cashback mensal por{" "}
              {plan.durationMonths} meses
            </p>
          </article>

          <div className="simulator-summary-grid">
            <article className="simulator-summary-card simulator-summary-card-dark">
              <span className="section-label">Cashback mensal</span>
              <strong>{formatCurrency(simulation.monthlyCashback)}</strong>
              <p>Retorno mensal proporcional à faixa escolhida.</p>
            </article>

            <article className="simulator-summary-card simulator-summary-card-dark simulator-summary-card-accent">
              <span className="section-label">Total em 12 meses</span>
              <strong>{formatCurrency(simulation.annualCashback)}</strong>
              <p>Cashback acumulado ao longo de 12 meses.</p>
            </article>

            <article className="simulator-summary-card simulator-summary-card-annual">
              <div className="simulator-summary-head">
                <span className="section-label">Valor total investido no ano</span>
                <strong>{formatCurrency(simulation.annualInvested)}</strong>
              </div>
              <p>Total investido ao longo de 12 meses.</p>
              <div className="simulator-summary-divider" />
              <div className="simulator-summary-foot">
                <span>Investimento mensal: {formatCurrency(simulation.investmentValue)}</span>
                <span>x {plan.durationMonths} meses</span>
              </div>
            </article>
          </div>
        </div>

        <article className="simulator-panel shell-panel simulator-timeline-panel">
          <div className="simulator-timeline-head">
            <div>
              <span className="section-label">Evolução do cashback</span>
              <h2 className="simulator-timeline-title">12 meses de retorno</h2>
            </div>
            <div className="simulator-timeline-meta">
              <span className="simulator-status-badge">
                <Dot size={20} strokeWidth={6} />
                Acumulado
              </span>
              <div className="simulator-active-total" aria-live="polite">
                <span>{activeMonth?.label ?? "Mês 12"}</span>
                <strong>{formatCurrency(activeMonth?.accumulatedReturn ?? simulation.annualCashback)}</strong>
              </div>
            </div>
          </div>

          <div
            className="simulator-chart-shell"
            aria-label="Projeção acumulada de 12 meses"
            onMouseMove={handleChartMove}
            onMouseLeave={() => setActiveMonthIndex(null)}
          >
            <svg
              className="simulator-chart"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-label={`Gráfico acumulado de cashback em ${plan.durationMonths} meses`}
            >
              <defs>
                <linearGradient id="simulator-chart-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(87, 223, 123, 0.34)" />
                  <stop offset="100%" stopColor="rgba(87, 223, 123, 0.02)" />
                </linearGradient>
                <linearGradient id="simulator-chart-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#31c85c" />
                  <stop offset="100%" stopColor="#8ff0ab" />
                </linearGradient>
              </defs>

              {guideLines.map(line => (
                <line
                  key={line}
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={line}
                  y2={line}
                  className="simulator-chart-guide"
                />
              ))}

              {chartPoints.map(point => {
                return (
                  <line
                    key={point.month.month}
                    x1={point.x}
                    x2={point.x}
                    y1={chartPadding.top}
                    y2={chartHeight - chartPadding.bottom}
                    className="simulator-chart-division"
                  />
                );
              })}

              <path d={filledAreaPath} className="simulator-chart-area" />
              <path 
                d={linePath} 
                className="simulator-chart-line" 
                style={{
                  strokeDasharray: pathLength,
                  strokeDashoffset: pathLength * (1 - lineProgress),
                  transition: isAnimating ? 'stroke-dashoffset 0.1s linear' : 'none',
                }}
              />
              
              {/* Indicador ativo - círculo com brilho ao redor do ponto */}
              {activePoint && (
                <>
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="14"
                    className="simulator-chart-active-indicator"
                    style={{ transformOrigin: `${activePoint.x}px ${activePoint.y}px` }}
                  />
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="8"
                    fill="rgba(143, 240, 171, 0.3)"
                    className="simulator-chart-active-glow"
                  />
                </>
              )}

              {chartPoints.map((point, index) => {
                return (
                  <g key={point.month.month}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="5.5"
                      className={`simulator-chart-point${safeActiveMonthIndex === index ? " is-active" : ""}`}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="15"
                      className="simulator-chart-hit"
                    />
                    <text
                      x={point.x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className={`simulator-chart-month${safeActiveMonthIndex === index ? " is-active" : ""}`}
                    >
                      {point.month.month}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="simulator-month-list">
            {simulation.months.map((month, index) => (
              <div
                key={month.month}
                className={`simulator-month-row${safeActiveMonthIndex === index ? " is-active" : ""}`}
                onMouseEnter={() => setActiveMonthIndex(index)}
                onMouseLeave={() => setActiveMonthIndex(null)}
              >
                <div className="simulator-month-row-main">
                  <span className="simulator-month-index">{month.month}</span>
                  <span className="simulator-month-label">{month.label}</span>
                </div>
                <div className="simulator-month-row-values">
                  <strong>+{formatCurrency(month.monthlyReturn)}</strong>
                  <span>{formatCurrency(month.accumulatedReturn)} acum.</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className="simulator-comparison-section">
        <div className="simulator-comparison-heading">
          <span className="section-label">Comparativo</span>
          <h2 className="section-title">Start vs Prime</h2>
          <p className="section-copy">
            Escolha a camada que melhor se encaixa no seu momento patrimonial.
          </p>
        </div>

        <div className="simulator-comparison-table" role="table" aria-label="Comparativo Start e Prime">
          <div className="simulator-comparison-table-head" role="rowgroup">
            <div className="simulator-comparison-criteria-head" />
            <div className="simulator-comparison-plan simulator-comparison-plan-start" role="columnheader">
              <span className="simulator-comparison-plan-name">Start</span>
              <strong>{formatCurrency(simulatorPlans.start.availableCredit, 0)}</strong>
              <span>até 50% / mês</span>
            </div>
            <div className="simulator-comparison-plan simulator-comparison-plan-prime" role="columnheader">
              <span className="simulator-comparison-plan-badge">Recomendado</span>
              <span className="simulator-comparison-plan-name">Prime</span>
              <strong>{formatCurrency(simulatorPlans.prime.availableCredit, 0)}</strong>
              <span>até 50% / mês</span>
            </div>
          </div>

          <div className="simulator-comparison-table-body" role="rowgroup">
            {simulatorComparisonRows.map(row => (
              <div key={row.label} className="simulator-comparison-row" role="row">
                <div className="simulator-comparison-label" role="rowheader">
                  {row.label}
                </div>
                <div className="simulator-comparison-value simulator-comparison-value-start" role="cell">
                  {renderDesktopComparisonValue(row.start)}
                </div>
                <div className="simulator-comparison-value simulator-comparison-value-prime" role="cell">
                  {renderDesktopComparisonValue(row.prime)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="simulator-comparison-cta-row simulator-comparison-cta-row-desktop">
          <div className="simulator-comparison-cta-spacer" aria-hidden="true" />
          <Link href="/auth?mode=register" className="secondary-button simulator-cta simulator-cta-start">
            Solicitar acesso Start
          </Link>
          <Link href="/auth?mode=register" className="primary-button simulator-cta simulator-cta-prime">
            Solicitar acesso Prime
          </Link>
        </div>

        <div className="simulator-comparison-mobile">
          {simulatorComparisonRows.map(row => (
            <article key={row.label} className="simulator-mobile-card">
              <p className="simulator-mobile-card-label">{row.label}</p>
              <div className="simulator-mobile-card-values">
                <div>
                  <span className="simulator-mobile-card-plan">Start</span>
                  {renderMobileComparisonValue(row.start)}
                </div>
                <div className="is-prime">
                  <span className="simulator-mobile-card-plan">Prime</span>
                  {renderMobileComparisonValue(row.prime)}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="simulator-cta-row simulator-cta-row-mobile">
        <Link href="/auth?mode=register" className="secondary-button simulator-cta simulator-cta-start">
          Solicitar acesso Start
        </Link>
        <Link href="/auth?mode=register" className="primary-button simulator-cta simulator-cta-prime">
          Solicitar acesso Prime
        </Link>
      </div>
    </div>
  );
}
