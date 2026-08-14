'use client';

import { useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════
   CashbackProjectionChart
   ─────────────────────────────────────────────────
   Pure presentation component — ALL data via props.
   Renders a 12-month cashback projection bar chart.
   ═══════════════════════════════════════════════════ */

export interface ChartDataPoint {
  /** Short month label (e.g. "Abr") */
  month: string;
  /** Full label for tooltip (e.g. "Abr/2026") */
  monthFull: string;
  /** Cashback value in BRL (reais, not cents) */
  value: number;
  /** Whether this month was already credited */
  paid: boolean;
}

export interface CashbackProjectionChartProps {
  /** Array of 12 data points, one per month */
  data: ChartDataPoint[];
  /** Day of month for credit (from config, default 16) */
  creditDay?: number;
}

export default function CashbackProjectionChart({
  data,
  creditDay = 16,
}: CashbackProjectionChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Chart, setChart] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    import('react-apexcharts').then((mod) => setChart(() => mod.default));
  }, []);

  if (!Chart) {
    return <div className="dash-hero-chart" style={{ minHeight: 200 }} />;
  }

  const barColors = data.map((d) => (d.paid ? '#059669' : '#38bdf8'));
  const categories = data.map((d) => d.month);
  const values = data.map((d) => d.value);

  const fmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      height: '100%',
      toolbar: { show: false },
      sparkline: { enabled: false },
      background: 'transparent',
      fontFamily: "'Inter', system-ui, sans-serif",
      animations: {
        enabled: true,
        speed: 800,
        animateGradually: { enabled: true, delay: 60 },
      },
      selection: { enabled: false },
      zoom: { enabled: false },
    },
    plotOptions: {
      bar: {
        borderRadius: 6,
        borderRadiusApplication: 'end',
        columnWidth: '55%',
        distributed: true,
      },
    },
    colors: barColors,
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      show: false,
      padding: { left: 4, right: 4, top: -12, bottom: -4 },
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: 'rgba(255,255,255,0.35)',
          fontSize: '10px',
          fontWeight: 600,
        },
      },
    },
    yaxis: { show: false },
    tooltip: {
      enabled: true,
      theme: 'dark',
      intersect: true,
      fixed: {
        enabled: false,
      },
      custom({ dataPointIndex }: { dataPointIndex: number }) {
        const pt = data[dataPointIndex];
        const status = pt.paid ? 'Creditado' : 'Previsto';
        const statusColor = pt.paid ? '#34d399' : '#38bdf8';

        return `
          <div style="
            background: rgba(8, 18, 32, 0.95);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 10px 14px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
            width: max-content;
            max-width: 160px;
            white-space: nowrap;
          ">
            <div style="
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
              color: rgba(255,255,255,0.4);
              margin-bottom: 4px;
            ">
              Crédito dia ${creditDay} · ${pt.monthFull}
            </div>
            <div style="
              font-size: 15px;
              font-weight: 800;
              color: #fff;
              font-variant-numeric: tabular-nums;
              margin-bottom: 4px;
            ">
              ${fmt.format(pt.value)}
            </div>
            <div style="
              font-size: 10px;
              font-weight: 600;
              color: ${statusColor};
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="
                width: 5px;
                height: 5px;
                border-radius: 50%;
                background: ${statusColor};
                display: inline-block;
              "></span>
              ${status}
            </div>
          </div>
        `;
      },
    },
    states: {
      hover: { filter: { type: 'lighten' } },
      active: { filter: { type: 'none' } },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        gradientToColors: barColors.map((c) =>
          c === '#059669' ? '#064e3b' : '#0c4a6e'
        ),
        stops: [0, 95],
        opacityFrom: 1,
        opacityTo: 0.7,
      },
    },
  };

  const series = [{ name: 'Cashback', data: values }];

  return (
    <div className="dash-hero-chart">
      <Chart
        options={options}
        series={series}
        type="bar"
        width="100%"
        height="100%"
      />
    </div>
  );
}
