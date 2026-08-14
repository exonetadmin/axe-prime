/**
 * Network Service - MLM Unilevel: rede, carreira, ganhos, árvore, cashback.
 */

import type {
  NetworkContract,
  NetworkMember,
  NetworkTreeNode,
  PositionInfo,
  PositionLevel,
  RedeUnilevel,
  EarningsSummary,
  CashbackSummary,
  NetworkCommissionSummary,
  DashboardSummary,
} from '../network.contract';
import {
  POSITION_LEVELS,
  CAREER_UNLOCK_LEVELS,
} from '../network.contract';
import { earningsRepository } from '../repositories/earnings.repository';
import { networkRepository } from '../repositories/network.repository';
import { configRepository } from '@/src/features/admin/config.repository';
import { supabase } from '@/lib/supabase';

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousPeriod(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

function firstAndLastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName.trim();
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function getNextCreditDate(day: number): string {
  const d = Math.max(1, Math.min(31, day));
  const now = new Date();
  let target = new Date(now.getFullYear(), now.getMonth(), d);
  if (now.getDate() >= d) {
    target = new Date(now.getFullYear(), now.getMonth() + 1, d);
  }
  return target.toISOString().split('T')[0];
}

export class NetworkService implements NetworkContract {
  async getReferralLink(userId: string): Promise<{ code: string } | null> {
    const code = await networkRepository.findReferralCodeByUserId(userId);
    return code ? { code } : null;
  }

  async getDirectReferrals(userId: string): Promise<NetworkMember[]> {
    const members = await networkRepository.getDirectReferrals(userId);
    const currentPeriod = getCurrentPeriod();
    const previousPeriod = getPreviousPeriod();
    const withActive = await Promise.all(members.map(async (m) => {
      const lastPeriod = await earningsRepository.getLastPaymentPeriod(m.id);
      const active =
        !!lastPeriod &&
        (lastPeriod === currentPeriod || lastPeriod === previousPeriod);
      return { ...m, active };
    }));
    return withActive;
  }

  async getMyNetwork(
    userId: string,
    maxDepth = 5   // MLM Unilevel: máximo 5 níveis por base
  ): Promise<RedeUnilevel> {
    const levels: RedeUnilevel['levels'] = [];
    let currentLevelIds = [userId];
    const currentPeriod = getCurrentPeriod();
    const previousPeriod = getPreviousPeriod();
    let totalMembers = 0;

    for (let levelNum = 1; levelNum <= maxDepth; levelNum++) {
      const nextLevelIds: string[] = [];
      for (const sponsorId of currentLevelIds) {
        const members = await networkRepository.getDirectReferrals(sponsorId);
        const withLevelAndActive = await Promise.all(members.map(async (m) => {
          const lastPeriod = await earningsRepository.getLastPaymentPeriod(m.id);
          const active =
            !!lastPeriod &&
            (lastPeriod === currentPeriod || lastPeriod === previousPeriod);
          return { ...m, level: levelNum, active };
        }));
        levels.push({ level: levelNum, members: withLevelAndActive });
        totalMembers += withLevelAndActive.length;
        nextLevelIds.push(...withLevelAndActive.map((m) => m.id));
      }
      currentLevelIds = nextLevelIds;
      if (currentLevelIds.length === 0) break;
    }

    return {
      rootUserId: userId,
      levels,
      totalMembers,
    };
  }

  async computeNetworkCommission(
    _userId: string,
    _period: { from: string; to: string }
  ): Promise<number> {
    void _userId;
    void _period;
    return 0;
  }

  private async isClient(userId: string): Promise<boolean> {
    // Prioriza adhesion_paid (campo gerenciado pelo admin) sobre adhesion_at
    const { data } = await supabase
      .from('users')
      .select('adhesion_paid, adhesion_at')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return false;
    return data.adhesion_paid === true || !!data.adhesion_at;
  }

  private async isActive(userId: string): Promise<boolean> {
    // Prioriza monthly_status (campo gerenciado pelo admin)
    const { data } = await supabase
      .from('users')
      .select('adhesion_paid, monthly_status')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return false;
    // Ativo = tem adesão paga E mensalidade não está atrasada
    if (data.adhesion_paid === true) {
      return data.monthly_status !== 'overdue';
    }
    // Fallback: verifica pagamentos na tabela payments
    const last = await earningsRepository.getLastPaymentPeriod(userId);
    if (!last) return false;
    const cur = getCurrentPeriod();
    const prev = getPreviousPeriod();
    return last === cur || last === prev;
  }

  private async countDirectClients(userId: string): Promise<number> {
    const refs = await networkRepository.getDirectReferrals(userId);
    const adhesions = await Promise.all(refs.map((r) => earningsRepository.getAdhesion(r.id)));
    return adhesions.filter((a) => a?.adhesionAt).length;
  }

  private async isQualifiedVendedorElite(userId: string): Promise<boolean> {
    const [client, directClients] = await Promise.all([
      this.isClient(userId),
      this.countDirectClients(userId),
    ]);
    return client || directClients >= 3;
  }

  private async countQualifiedAndActive(
    userId: string,
    requiredLevel: PositionLevel
  ): Promise<number> {
    const refs = await networkRepository.getDirectReferrals(userId);
    let count = 0;
    for (const r of refs) {
      const [qualified, active] = await Promise.all([
        requiredLevel === 'vendedor_elite'
          ? this.isQualifiedVendedorElite(r.id)
          : this.isQualifiedAtLevel(r.id, requiredLevel),
        this.isActive(r.id),
      ]);
      if (qualified && active) count++;
    }
    return count;
  }

  private async isQualifiedAtLevel(
    userId: string,
    level: PositionLevel
  ): Promise<boolean> {
    switch (level) {
      case 'vendedor_elite':
        return this.isQualifiedVendedorElite(userId);
      case 'supervisor':
        return (await this.countQualifiedAndActive(userId, 'vendedor_elite')) >= 2;
      case 'gestor':
        return (await this.countQualifiedAndActive(userId, 'supervisor')) >= 2;
      case 'gerente_senior':
        return (await this.countQualifiedAndActive(userId, 'gestor')) >= 2;
      case 'diretor_geral':
        return (await this.countQualifiedAndActive(userId, 'gerente_senior')) >= 2;
      default:
        return false;
    }
  }

  async getPosition(userId: string): Promise<PositionInfo> {
    // ── 1. Carreira manual definida pelo admin (prioridade máxima) ────────────
    const user = await networkRepository.getUserById(userId);
    const manualCareer = user?.career as PositionLevel | null;
    if (manualCareer && manualCareer in POSITION_LEVELS) {
      const order: PositionLevel[] = [
        'diretor_geral', 'gerente_senior', 'gestor', 'supervisor', 'vendedor_elite',
      ];
      const nextLevel = order[order.indexOf(manualCareer) - 1] as PositionLevel | undefined;
      return {
        level: manualCareer,
        label: POSITION_LEVELS[manualCareer].label,
        requirement: POSITION_LEVELS[manualCareer].requirement,
        // Carreira manual: sem barra de progresso para o próximo nível
        progress: nextLevel ? { current: CAREER_UNLOCK_LEVELS[manualCareer], required: CAREER_UNLOCK_LEVELS[nextLevel] } : null,
      };
    }

    // ── 2. Cálculo automático por atividade da rede ────────────────────────────
    const order: PositionLevel[] = [
      'diretor_geral',
      'gerente_senior',
      'gestor',
      'supervisor',
      'vendedor_elite',
    ];
    for (const level of order) {
      if (await this.isQualifiedAtLevel(userId, level)) {
        const nextLevel =
          order[order.indexOf(level) - 1] as PositionLevel | undefined;
        let progress: { current: number; required: number } | null = null;
        if (nextLevel) {
          const required = 2;
          const current = await this.countQualifiedAndActive(userId, level);
          progress = { current: Math.min(current, required), required };
        }
        return {
          level,
          label: POSITION_LEVELS[level].label,
          requirement: POSITION_LEVELS[level].requirement,
          progress,
        };
      }
    }
    const client = await this.isClient(userId);
    return {
      level: 'vendedor_elite',
      label: POSITION_LEVELS.vendedor_elite.label,
      requirement: POSITION_LEVELS.vendedor_elite.requirement,
      progress: {
        current: client ? 1 : 0,
        required: client ? 1 : 3,
      },
    };
  }

  async getNetworkTree(
    userId: string,
    maxDepth = 5,
    currentLevel = 0,
    levelInBase = 0,   // 0 = raiz (sem badge), 1-5 = N1 a N5
    isNewBase = false  // true quando ultra passa a base de 5 (apenas admin)
  ): Promise<NetworkTreeNode> {
    const user = await networkRepository.getUserById(userId);
    const name = user?.name ?? 'Usuário';
    const currentPeriod = getCurrentPeriod();
    const previousPeriod = getPreviousPeriod();
    const lastPeriod = await earningsRepository.getLastPaymentPeriod(userId);
    const active =
      !!lastPeriod &&
      (lastPeriod === currentPeriod || lastPeriod === previousPeriod);

    const children: NetworkTreeNode[] = [];
    if (maxDepth > 0) {
      const refs = await networkRepository.getDirectReferrals(userId);
      for (const r of refs) {
        const childIsNewBase = levelInBase >= 5;
        const childLevelInBase = childIsNewBase ? 1 : levelInBase + 1;
        const child = await this.getNetworkTree(
          r.id,
          maxDepth - 1,
          currentLevel + 1,
          childLevelInBase,
          childIsNewBase
        );
        children.push(child);
      }
    }

    return {
      id: userId,
      displayName: firstAndLastName(name),
      active,
      level: currentLevel,
      levelInBase,
      isNewBase,
      avatarUrl: (user as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      children,
    };
  }

  async getEarningsSummary(userId: string): Promise<EarningsSummary> {
    const [disponivelCents, aReceberCents, salesWithProjection] = await Promise.all([
      earningsRepository.getDisponivelCents(userId),
      earningsRepository.getAReceberCents(userId),
      earningsRepository.getSalesWithProjection(userId),
    ]);
    return {
      disponivelCents,
      aReceberCents,
      salesWithProjection,
    };
  }

  async getCashbackSummary(userId: string): Promise<CashbackSummary> {
    const data = await earningsRepository.getCashbackData(userId);
    const cashCfg = await configRepository.getCashbackConfig();
    const creditDay = cashCfg.credit_day;
    const durationMonths = cashCfg.duration_months || 12;

    // Sempre busca meses realmente pagos — independente de adhesion_at
    const { data: paidRows } = await supabase
      .from('cashback_payments')
      .select('month_number, amount_cents')
      .eq('user_id', userId);

    const paidMonths = (paidRows ?? []) as { month_number: number; amount_cents: number }[];
    const realMesesPagos = paidMonths.length;
    // disponivelCents = soma real dos pagamentos confirmados (sempre presente)
    const disponivelCents = paidMonths.reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    if (!data) {
      // Sem dados de contrato, mas pode ter pagamentos feitos pelo admin
      return {
        planMonthlyCents: 0,
        percentual: 0,
        disponivelCents,
        previstoMesCents: 0,
        totalPrevistoRestanteCents: 0,
        proximoCredito: getNextCreditDate(creditDay),
        mesesRestantes: Math.max(0, durationMonths - realMesesPagos),
        mesesPagos: realMesesPagos,
        ativo: realMesesPagos > 0,
      };
    }

    const cashbackPerMonth = Math.floor(
      (data.planMonthlyCents * data.percentual) / 100
    );

    const mesesRestantes = Math.max(0, durationMonths - realMesesPagos);
    const previstoMesCents = mesesRestantes > 0 ? cashbackPerMonth : 0;
    const totalPrevistoRestanteCents = cashbackPerMonth * mesesRestantes;

    return {
      planMonthlyCents: data.planMonthlyCents,
      percentual: data.percentual,
      disponivelCents,
      previstoMesCents,
      totalPrevistoRestanteCents,
      proximoCredito: getNextCreditDate(creditDay),
      mesesRestantes,
      mesesPagos: realMesesPagos,
      ativo: true,
    };
  }

  async getNetworkCommissionSummary(
    userId: string
  ): Promise<NetworkCommissionSummary> {
    const [position, commCfg] = await Promise.all([
      this.getPosition(userId),
      configRepository.getCommissionConfig(),
    ]);
    const levelIndex: Record<PositionLevel, number> = {
      vendedor_elite: 0,
      supervisor: 1,
      gestor: 2,
      gerente_senior: 3,
      diretor_geral: 4,
    };
    const unlockedLevels = levelIndex[position.level] ?? 0;

    // Soma os percentuais de rede configurados para os níveis desbloqueados
    const networkPcts = [
      commCfg.level1_pct,
      commCfg.level2_pct,
      commCfg.level3_pct,
      commCfg.level4_pct,
      commCfg.level5_pct,
    ];
    const percentualDesbloqueado = networkPcts
      .slice(0, unlockedLevels)
      .reduce((sum, p) => sum + p, 0);

    const [disponivelCents, network] = await Promise.all([
      earningsRepository.getNetworkCommissionCents(userId),
      this.getMyNetwork(userId, 5),
    ]);

    return {
      percentualDesbloqueado,
      disponivelCents,
      previstoTotalCents: 0,
      totalMembros: network.totalMembers,
    };
  }

  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const [cashback, indicacoes, rede] = await Promise.all([
      this.getCashbackSummary(userId),
      this.getEarningsSummary(userId),
      this.getNetworkCommissionSummary(userId),
    ]);
    return { cashback, indicacoes, rede };
  }

  /**
   * Fonte ÚNICA de verdade do saldo da carteira. Usada pela carteira e pela
   * validação de saque.
   *
   * Modelo simples e verificável (sem split proporcional):
   *   • bruto por origem = ganhos confirmados (cashback pago + comissões
   *     diretas/rede com status available|paid). É o "creditado/acumulado"
   *     mostrado igual em todas as telas.
   *   • withdrawnCents = saques que NÃO foram rejeitados (pending + approved).
   *   • availableCents = max(0, totalGanho − sacado) → o ÚNICO "saldo
   *     disponível para saque", exibido só na carteira.
   *
   * Assim cada número é conferível: origens(bruto) − sacado = saldo disponível.
   */
  async getWalletBalance(userId: string, dashboard?: DashboardSummary): Promise<{
    grossCashbackCents: number;
    grossDirectCents: number;
    grossNetworkCents: number;
    grossTotalCents: number;
    withdrawnCents: number;
    availableCents: number;
  }> {
    // Reutiliza o dashboard já carregado pela tela (quando houver) para não
    // recomputar a rede inteira; senão, busca sob demanda.
    const { cashback, indicacoes, rede } = dashboard ?? await this.getDashboardSummary(userId);

    const grossCashbackCents = cashback.disponivelCents;
    const grossDirectCents = indicacoes.disponivelCents;
    const grossNetworkCents = rede.disponivelCents;
    const grossTotalCents = grossCashbackCents + grossDirectCents + grossNetworkCents;

    // Saques que descontam o saldo: pendentes + aprovados (dinheiro a caminho ou
    // já enviado). Apenas 'rejected' devolve o valor ao saldo.
    const { data: wds } = await supabase
      .from('withdrawal_requests')
      .select('amount_cents')
      .eq('user_id', userId)
      .in('status', ['pending', 'approved']);
    const withdrawnCents = (wds ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    const availableCents = Math.max(0, grossTotalCents - withdrawnCents);

    return {
      grossCashbackCents,
      grossDirectCents,
      grossNetworkCents,
      grossTotalCents,
      withdrawnCents,
      availableCents,
    };
  }
}

export const networkService = new NetworkService();
