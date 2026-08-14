/**
 * Network (MLM Unilevel) Contract - Public API
 *
 * Defines types and service interface for the referral network.
 * Commission: 10% direct (12 months), 2% per level rede (até 8%, 12 months).
 */

export type NetworkMember = {
  id: string;
  name: string;
  email: string;
  planInterest: 'start' | 'prime' | 'elite' | null;
  referralCode: string;
  createdAt: string;
  level: number;
  /** Indica se está com pagamentos em dia (ativo). */
  active?: boolean;
};

export type NetworkLevel = {
  level: number;
  members: NetworkMember[];
};

export type RedeUnilevel = {
  rootUserId: string;
  levels: NetworkLevel[];
  totalMembers: number;
};

/** Nó da árvore para visualização (círculos, expandir). */
export type NetworkTreeNode = {
  id: string;
  /** Primeiro nome + sobrenome */
  displayName: string;
  active: boolean;
  level: number;
  avatarUrl?: string | null;
  /**
   * Posição dentro da base de 5 níveis (1-5).
   * Nível 5 = último da base. Filhos deste nó iniciam uma nova base.
   */
  levelInBase: number;
  /**
   * true quando este nó inicia uma nova cadeia de 5 níveis
   * (seu pai estava em levelInBase=5).
   * No contexto do PORTAL DO USUÁRIO isso nunca é true porque
   * o usuário só enxerga sua própria base (maxDepth=5).
   */
  isNewBase: boolean;
  children: NetworkTreeNode[];
};

/** Níveis de posição na carreira (escada). */
export type PositionLevel =
  | 'vendedor_elite'
  | 'supervisor'
  | 'gestor'
  | 'gerente_senior'
  | 'diretor_geral';

export type PositionInfo = {
  level: PositionLevel;
  label: string;
  requirement: string;
  /** Progresso atual: ex. { current: 1, required: 2 } para "1/2 Advisors" */
  progress: { current: number; required: number } | null;
};

export type EarningsSummary = {
  disponivelCents: number;
  aReceberCents: number;
  salesWithProjection: {
    referredUserId: string;
    referredName: string;
    adhesionAt: string;
    planMonthlyCents: number;
    commissionPerMonthCents: number;
    monthsPaid: number;
    monthsRemaining: number;
    totalPaidCents: number;
    totalAReceberCents: number;
  }[];
};

/** Resumo de cashback do investimento do próprio usuário. */
export type CashbackSummary = {
  /** Plano mensal em centavos */
  planMonthlyCents: number;
  /** Percentual de cashback aplicado (30-50) */
  percentual: number;
  /** Total já creditado (disponível) */
  disponivelCents: number;
  /** Valor previsto para o mês atual (credita no dia configurado) */
  previstoMesCents: number;
  /** Total restante dos próximos meses */
  totalPrevistoRestanteCents: number;
  /** Data do próximo crédito (dia configurado via admin) */
  proximoCredito: string;
  /** Meses restantes de cashback */
  mesesRestantes: number;
  /** Meses já pagos */
  mesesPagos: number;
  /** Se tem adesão ativa */
  ativo: boolean;
};

/** Resumo de comissões da rede (níveis 2+) */
export type NetworkCommissionSummary = {
  /** Percentual máximo desbloqueado pela posição */
  percentualDesbloqueado: number;
  /** Total disponível (já creditado) */
  disponivelCents: number;
  /** Total previsto (projeção futura) */
  previstoTotalCents: number;
  /** Total de membros na rede */
  totalMembros: number;
};

/** Dashboard combinado para a home do portal */
export type DashboardSummary = {
  cashback: CashbackSummary;
  indicacoes: EarningsSummary;
  rede: NetworkCommissionSummary;
};

export const COMMISSION_DIRECT_PCT = 10;
export const COMMISSION_NETWORK_PCT = 2;
export const COMMISSION_NETWORK_MAX_PCT = 8;
export const COMMISSION_MONTHS = 12;

/**
 * Quantos níveis de rede cada carreira desbloqueia.
 * N1 (direto) é sempre garantido — esses são os níveis de REDE (N2+).
 * Afiliado Prime: só N1 direto, sem comissão de rede.
 * Diretor Geral: N1 direto + N2, N3, N4, N5 (máximo 4 níveis × 2% = 8%).
 */
export const CAREER_UNLOCK_LEVELS: Record<PositionLevel, number> = {
  vendedor_elite: 1,  // só comissão direta (N1)
  supervisor:     2,  // N1 + N2
  gestor:         3,  // N1 + N2 + N3
  gerente_senior: 4,  // N1 + N2 + N3 + N4
  diretor_geral:  5,  // N1 + N2 + N3 + N4 + N5
};

/** Cashback padrão para investimentos abaixo de R$10k/mês */
export const CASHBACK_DEFAULT_PCT = 40;
/** Limite mensal (em centavos) para tier alto de cashback */
export const CASHBACK_HIGH_TIER_THRESHOLD_CENTS = 1_000_000;
/** Cashback automático para investimentos >= R$10k/mês */
export const CASHBACK_HIGH_TIER_PCT = 50;

export const POSITION_LEVELS: Record<
  PositionLevel,
  { label: string; requirement: string }
> = {
  vendedor_elite: {
    label: 'Afiliado Prime',
    requirement: 'Seja cliente ou tenha 3 clientes',
  },
  supervisor: {
    label: 'Advisor',
    requirement: 'Tenha 2 Afiliados Prime Qualificados e ativos',
  },
  gestor: {
    label: 'Gestor',
    requirement: 'Tenha 2 Advisors Qualificados e ativos',
  },
  gerente_senior: {
    label: 'Gerente Sênior',
    requirement: 'Tenha 2 Gestores Qualificados e ativos',
  },
  diretor_geral: {
    label: 'Diretor Geral',
    requirement: 'Tenha 2 Gerentes Qualificados e ativos',
  },
};

export interface NetworkContract {
  getMyNetwork(userId: string, maxDepth?: number): Promise<RedeUnilevel>;
  getDirectReferrals(userId: string): Promise<NetworkMember[]>;
  getReferralLink(userId: string): Promise<{ code: string } | null>;
  computeNetworkCommission(
    userId: string,
    period: { from: string; to: string }
  ): Promise<number>;

  /** Posição atual na carreira e progresso para o próximo nível. */
  getPosition(userId: string): Promise<PositionInfo>;

  /** Árvore da rede para UI (círculos, ativo/inativo, expandir). */
  getNetworkTree(userId: string, maxDepth?: number): Promise<NetworkTreeNode>;

  /** Resumo de ganhos: disponível para saque e a receber (11 meses). */
  getEarningsSummary(userId: string): Promise<EarningsSummary>;

  /** Resumo de cashback do investimento. */
  getCashbackSummary(userId: string): Promise<CashbackSummary>;

  /** Resumo de comissões da rede (níveis 2+). */
  getNetworkCommissionSummary(userId: string): Promise<NetworkCommissionSummary>;

  /** Dashboard combinado (home do portal). */
  getDashboardSummary(userId: string): Promise<DashboardSummary>;
}
