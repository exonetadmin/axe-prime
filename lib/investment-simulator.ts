export type SimulatorPlanId = "start" | "prime";

export type CashbackRate = 10 | 20 | 30 | 40 | 50;

export type SimulatorPlanConfig = {
  id: SimulatorPlanId;
  name: string;
  tabLabel: string;
  tabNote: string;
  minimumInvestment: number;
  maximumInvestment: number;
  availableCredit: number;
  maxCashbackRate: CashbackRate;
  durationMonths: number;
  monthlyCashbackAtMaxRate: number;
  annualCashbackAtMaxRate: number;
  comparison: {
    careerPlan: boolean;
    specializedSupport: boolean;
    exclusiveAssetsPriority: boolean;
    acceleratedCashback: boolean;
    dedicatedManager: boolean;
  };
};

export type ProjectionMonth = {
  month: number;
  label: string;
  monthlyReturn: number;
  accumulatedReturn: number;
};

export type SimulationResult = {
  selectedPlan: SimulatorPlanId;
  selectedRate: CashbackRate;
  investmentValue: number;
  monthlyCashback: number;
  annualCashback: number;
  annualInvested: number;
  months: ProjectionMonth[];
};

export type ComparisonValue = string | boolean;

export type ComparisonRow = {
  label: string;
  start: ComparisonValue;
  prime: ComparisonValue;
};

export const simulatorRates: CashbackRate[] = [10, 20, 30, 40, 50];

export const simulatorPlans: Record<SimulatorPlanId, SimulatorPlanConfig> = {
  start: {
    id: "start",
    name: "Start",
    tabLabel: "Plano Start",
    tabNote: "R$ 520+",
    minimumInvestment: 520,
    maximumInvestment: 500000,
    availableCredit: 100000,
    maxCashbackRate: 50,
    durationMonths: 12,
    monthlyCashbackAtMaxRate: 260,
    annualCashbackAtMaxRate: 3120,
    comparison: {
      careerPlan: true,
      specializedSupport: true,
      exclusiveAssetsPriority: false,
      acceleratedCashback: false,
      dedicatedManager: false,
    },
  },
  prime: {
    id: "prime",
    name: "Prime",
    tabLabel: "Plano Prime",
    tabNote: "R$ 1.040+",
    minimumInvestment: 1040,
    maximumInvestment: 1000000,
    availableCredit: 200000,
    maxCashbackRate: 50,
    durationMonths: 12,
    monthlyCashbackAtMaxRate: 520,
    annualCashbackAtMaxRate: 6240,
    comparison: {
      careerPlan: true,
      specializedSupport: true,
      exclusiveAssetsPriority: true,
      acceleratedCashback: true,
      dedicatedManager: true,
    },
  },
};

export const simulatorComparisonRows: ComparisonRow[] = [
  {
    label: "Aporte mensal mínimo",
    start: formatCurrency(simulatorPlans.start.minimumInvestment, 0),
    prime: formatCurrency(simulatorPlans.prime.minimumInvestment, 0),
  },
  {
    label: "Crédito disponível",
    start: formatCurrency(simulatorPlans.start.availableCredit, 0),
    prime: formatCurrency(simulatorPlans.prime.availableCredit, 0),
  },
  {
    label: "Cashback mensal máximo",
    start: formatCurrency(simulatorPlans.start.monthlyCashbackAtMaxRate, 0),
    prime: formatCurrency(simulatorPlans.prime.monthlyCashbackAtMaxRate, 0),
  },
  {
    label: "Cashback acumulado em 12 meses",
    start: formatCurrency(simulatorPlans.start.annualCashbackAtMaxRate, 0),
    prime: formatCurrency(simulatorPlans.prime.annualCashbackAtMaxRate, 0),
  },
  {
    label: "Duração do cashback",
    start: `${simulatorPlans.start.durationMonths} meses`,
    prime: `${simulatorPlans.prime.durationMonths} meses`,
  },
  {
    label: "Acesso ao plano de carreira",
    start: simulatorPlans.start.comparison.careerPlan,
    prime: simulatorPlans.prime.comparison.careerPlan,
  },
  {
    label: "Suporte especializado",
    start: simulatorPlans.start.comparison.specializedSupport,
    prime: simulatorPlans.prime.comparison.specializedSupport,
  },
  {
    label: "Prioridade em ativos exclusivos",
    start: simulatorPlans.start.comparison.exclusiveAssetsPriority,
    prime: simulatorPlans.prime.comparison.exclusiveAssetsPriority,
  },
  {
    label: "Cashback acelerado",
    start: simulatorPlans.start.comparison.acceleratedCashback,
    prime: simulatorPlans.prime.comparison.acceleratedCashback,
  },
  {
    label: "Gestor dedicado",
    start: simulatorPlans.start.comparison.dedicatedManager,
    prime: simulatorPlans.prime.comparison.dedicatedManager,
  },
];

export function clampInvestmentValue(planId: SimulatorPlanId, value: number) {
  const plan = simulatorPlans[planId];
  const normalized = Number.isFinite(value) ? value : plan.minimumInvestment;
  const stepped = Math.round(normalized / 10) * 10;
  return Math.min(plan.maximumInvestment, Math.max(plan.minimumInvestment, stepped));
}

export function calculateSimulation(
  selectedPlan: SimulatorPlanId,
  selectedRate: CashbackRate,
  investmentValue: number,
): SimulationResult {
  const plan = simulatorPlans[selectedPlan];
  const safeInvestment = clampInvestmentValue(selectedPlan, investmentValue);
  const safeRate = Math.min(selectedRate, plan.maxCashbackRate) as CashbackRate;
  const monthlyCashback = roundMoney(safeInvestment * (safeRate / 100));
  const annualCashback = roundMoney(monthlyCashback * plan.durationMonths);
  const annualInvested = roundMoney(safeInvestment * plan.durationMonths);
  const months = Array.from({ length: plan.durationMonths }, (_, index) => {
    const month = index + 1;
    return {
      month,
      label: `Mês ${month}`,
      monthlyReturn: monthlyCashback,
      accumulatedReturn: roundMoney(monthlyCashback * month),
    };
  });

  return {
    selectedPlan,
    selectedRate: safeRate,
    investmentValue: safeInvestment,
    monthlyCashback,
    annualCashback,
    annualInvested,
    months,
  };
}

export function formatCurrency(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
