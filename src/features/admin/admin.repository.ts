/**
 * Admin Repository — Supabase Postgres
 * Cross-user queries for the admin panel.
 */

import { supabase } from '@/lib/supabase';
import { configRepository } from './config.repository';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminUserRow = {
  id: string; name: string; email: string; phone: string | null; plan_interest: string | null;
  referral_code: string | null; sponsor_id: string | null; adhesion_at: string | null;
  plan_monthly_cents: number | null; adhesion_value_cents: number | null;
  cashback_pct: number | null; is_active: boolean | null; created_at: string;
  career: string | null;
  adhesion_paid: boolean | null;
  monthly_status: 'paid' | 'overdue' | null;
};

export type AdminNetworkNode = {
  id: string; name: string; email: string; sponsor_id: string | null;
  adhesion_at: string | null; plan_interest: string | null;
  avatar_url: string | null;
  globalLevel: number; levelInBase: number; isNewBase: boolean;
  children: AdminNetworkNode[];
};

export type WithdrawalRequestRow = {
  id: string; user_id: string; user_name: string; user_email: string;
  amount_cents: number; pix_key: string; pix_key_type: string; status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null; reviewed_at: string | null; review_note: string | null;
  created_at: string; requested_at: string;
};

export type CommissionRow = {
  id: string; sponsor_id: string; sponsor_name: string;
  referred_user_id: string; referred_name: string;
  type: string; level: number; amount_cents: number;
  period: string; status: string; created_at: string;
};

export type PaymentRow = {
  id: string; user_id: string; user_name: string;
  amount_cents: number; period: string; paid_at: string;
};

export type CashbackPaymentRow = {
  id: string; user_id: string; month_number: number;
  amount_cents: number; paid_at: string; paid_by: string | null;
};

// ── Repository ────────────────────────────────────────────────────────────────

export class AdminRepository {
  // ── Usuários ──────────────────────────────────────────────────────────────

  async listUsers(search = '', limit = 50, offset = 0): Promise<{ rows: AdminUserRow[]; total: number }> {
    let q = supabase
      .from('users')
      .select(
        'id, name, email, phone, plan_interest, referral_code, sponsor_id, adhesion_at, plan_monthly_cents, adhesion_value_cents, cashback_pct, is_active, created_at, career, adhesion_paid, monthly_status',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,referral_code.ilike.%${search}%`);
    }

    const { data, count } = await q;
    type UserRow = { cashback_pct?: number; [key: string]: unknown };
    const rows = (data ?? []).map((r: UserRow) => ({
      ...r,
      cashback_pct: r.cashback_pct ?? 40,
    })) as AdminUserRow[];
    return { rows, total: count ?? 0 };
  }

  async countUsersByPlan(): Promise<{ plan: string; count: number }[]> {
    const allUsers = await supabase.from('users').select('plan_interest');
    const map: Record<string, number> = {};
    for (const u of allUsers.data ?? []) {
      const key = u.plan_interest ?? 'sem_plano';
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([plan, count]) => ({ plan, count }))
      .sort((a, b) => b.count - a.count);
  }

  async countActiveUsers(): Promise<number> {
    // Usuários ativos = adhesion_paid true E (monthly_status = 'paid' ou sem status de atraso)
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('adhesion_paid', true)
      .neq('monthly_status', 'overdue');
    return count ?? 0;
  }

  async updateUserPlan(
    userId: string,
    opts: { plan: string; cashbackPct: number; adhesionValueCents: number | null; monthlyValueCents: number | null }
  ): Promise<void> {
    // 'sem_plano' deve ser armazenado como null no banco
    const planValue = opts.plan === 'sem_plano' ? null : opts.plan;
    const { error } = await supabase.from('users').update({
      plan_interest: planValue,
      cashback_pct: opts.cashbackPct,
      plan_monthly_cents: opts.monthlyValueCents,
      adhesion_value_cents: opts.adhesionValueCents,
    }).eq('id', userId);
    if (error) throw new Error(`[updateUserPlan] ${error.message}`);
  }

  async updateUserCareer(userId: string, career: string | null): Promise<void> {
    await supabase.from('users').update({ career }).eq('id', userId);
  }

  async updateAdhesionPaid(userId: string, paid: boolean): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({
        adhesion_paid: paid,
        // Sincroniza adhesion_at — todo o sistema (cashback, rede, carreira) usa este campo
        adhesion_at: paid ? new Date().toISOString() : null,
      })
      .eq('id', userId);
    if (error) throw new Error(`[updateAdhesionPaid] ${error.message}`);
  }

  async updateMonthlyStatus(userId: string, status: 'paid' | 'overdue' | null): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ monthly_status: status })
      .eq('id', userId);
    if (error) throw new Error(`[updateMonthlyStatus] ${error.message}`);
  }

  async getDashboardStats(): Promise<{
    activeUsersCount: number;
    pendingWithdrawalsCount: number;
    pendingPixAprovarCount: number;
    volumeMonthCents: number;
    networkMembersCount: number;
    paidCommissionsCents: number;
  }> {
    const period = currentPeriod();

    const [
      { count: activeUsers },
      { data: commissions },
      { count: pendingWithdrawals },
      { count: pendingKyc },
      { count: networkMembers },
      { data: volumeData },
    ] = await Promise.all([
      // 1. Usuários Ativos (adhesion_paid = true E não estão overdue)
      supabase.from('users').select('*', { count: 'exact', head: true })
        .eq('adhesion_paid', true)
        .neq('monthly_status', 'overdue'),
      
      // 2. Comissões Pagas
      supabase.from('commission_entries').select('amount_cents').eq('status', 'paid'),
      
      // 3. Saques Pendentes
      supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      
      // 4. PIX a Aprovar
      supabase.from('plan_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      
      // 5. Membros na Rede (usuários que têm um patrocinador)
      supabase.from('users').select('*', { count: 'exact', head: true }).not('sponsor_id', 'is', null),

      // 6. Volume no Mês Atual
      supabase.from('payments').select('amount_cents').eq('period', period),
    ]);

    const paidCommissionsCents = (commissions ?? []).reduce((s: number, r: { amount_cents: number }) => s + (r.amount_cents ?? 0), 0);
    const volumeMonthCents = (volumeData ?? []).reduce((s: number, r: { amount_cents: number }) => s + (r.amount_cents ?? 0), 0);

    return {
      activeUsersCount: activeUsers ?? 0,
      pendingWithdrawalsCount: pendingWithdrawals ?? 0,
      pendingPixAprovarCount: pendingKyc ?? 0,
      volumeMonthCents,
      networkMembersCount: networkMembers ?? 0,
      paidCommissionsCents,
    };
  }

  // ── Comissões ─────────────────────────────────────────────────────────────

  async listCommissions(limit = 50, offset = 0): Promise<{ rows: CommissionRow[]; total: number }> {
    const { data, count } = await supabase
      .from('commission_entries')
      .select('*, sponsor:users!sponsor_id(name), referred:users!referred_user_id(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    type CommEntry = { sponsor?: { name: string }; referred?: { name: string }; [key: string]: unknown };
    const rows = (data ?? []).map((r: CommEntry) => ({
      ...r,
      sponsor_name: r.sponsor?.name ?? '',
      referred_name: r.referred?.name ?? '',
    })) as CommissionRow[];
    return { rows, total: count ?? 0 };
  }

  // ── Pagamentos ─────────────────────────────────────────────────────────────

  async listPayments(limit = 50, offset = 0): Promise<{ rows: PaymentRow[]; total: number }> {
    const { data, count } = await supabase
      .from('payments')
      .select('*, users(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    type PayEntry = { users?: { name: string }; [key: string]: unknown };
    const rows = (data ?? []).map((r: PayEntry) => ({
      ...r,
      user_name: r.users?.name ?? '',
    })) as PaymentRow[];
    return { rows, total: count ?? 0 };
  }

  // ── Saques ─────────────────────────────────────────────────────────────────

  async listWithdrawals(
    status: 'pending' | 'approved' | 'rejected' | 'all' = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: WithdrawalRequestRow[]; total: number }> {
    let q = supabase
      .from('withdrawal_requests')
      .select('*, users(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') q = q.eq('status', status);

    const { data, count } = await q;
    type WithdrawEntry = { users?: { name: string; email: string }; pix_key_type?: string; requested_at?: string; created_at: string; [key: string]: unknown };
    const rows = (data ?? []).map((r: WithdrawEntry) => ({
      ...r,
      user_name: r.users?.name ?? '',
      user_email: r.users?.email ?? '',
      pix_key_type: r.pix_key_type ?? 'cpf',
      requested_at: r.requested_at ?? r.created_at,
    })) as WithdrawalRequestRow[];
    return { rows, total: count ?? 0 };
  }

  async approveWithdrawal(id: string, processedBy: string): Promise<void> {
    await supabase.from('withdrawal_requests').update({
      status: 'approved', reviewed_by: processedBy, reviewed_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async rejectWithdrawal(id: string, processedBy: string, note: string): Promise<void> {
    await supabase.from('withdrawal_requests').update({
      status: 'rejected', reviewed_by: processedBy, reviewed_at: new Date().toISOString(), review_note: note,
    }).eq('id', id);
  }

  // ── Rede / árvore MLM ─────────────────────────────────────────────────────

  async getFullNetworkTree(rootId: string | null): Promise<AdminNetworkNode[]> {
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, name, email, sponsor_id, adhesion_at, plan_interest, avatar_url');

    if (!allUsers) return [];

    type RawUser = { id: string; name: string; email: string; sponsor_id: string | null; adhesion_at: string | null; plan_interest: string | null; avatar_url: string | null };
    const rawMap = new Map<string, RawUser>();
    for (const u of allUsers as RawUser[]) rawMap.set(u.id, u);

    const childrenMap = new Map<string, string[]>();
    for (const u of allUsers as RawUser[]) {
      if (u.sponsor_id) {
        const arr = childrenMap.get(u.sponsor_id) ?? [];
        arr.push(u.id);
        childrenMap.set(u.sponsor_id, arr);
      }
    }

    const BASE_SIZE = 5;
    function buildNode(id: string, globalLevel: number, levelInBase: number, isNewBase: boolean): AdminNetworkNode {
      const raw = rawMap.get(id)!;
      const childIds = childrenMap.get(id) ?? [];
      const children: AdminNetworkNode[] = childIds.map((cid) => {
        const childIsNewBase = levelInBase >= BASE_SIZE;
        return buildNode(cid, globalLevel + 1, childIsNewBase ? 1 : levelInBase + 1, childIsNewBase);
      });
      return { id, name: raw.name, email: raw.email, sponsor_id: raw.sponsor_id, adhesion_at: raw.adhesion_at, plan_interest: raw.plan_interest, avatar_url: raw.avatar_url, globalLevel, levelInBase, isNewBase, children };
    }

    if (rootId) {
      const raw = rawMap.get(rootId);
      if (!raw) return [];
      return [buildNode(rootId, 0, 0, false)];
    }

    const rootIds = (allUsers as RawUser[])
      .filter((u) => !u.sponsor_id || !rawMap.has(u.sponsor_id))
      .map((u) => u.id);
    return rootIds.map((id) => buildNode(id, 0, 0, false));
  }

  async getTopSponsors30d(limit = 10): Promise<{
    id: string; name: string; referrals30d: number; referralsPrev: number;
    totalReferrals: number; activeReferrals: number; conversionPct: number; delta: number;
  }[]> {
    const now = new Date();
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const { data: allUsers } = await supabase.from('users').select('id, name, sponsor_id, created_at, adhesion_at');
    if (!allUsers) return [];

    type URow = { id: string; name: string; sponsor_id: string | null; created_at: string; adhesion_at: string | null };
    const sponsorMap = new Map<string, { name: string; referrals: URow[] }>();
    for (const u of allUsers as URow[]) {
      if (!u.sponsor_id) continue;
      if (!sponsorMap.has(u.sponsor_id)) {
        const sponsor = (allUsers as URow[]).find((x) => x.id === u.sponsor_id);
        if (!sponsor) continue;
        sponsorMap.set(u.sponsor_id, { name: sponsor.name, referrals: [] });
      }
      sponsorMap.get(u.sponsor_id)!.referrals.push(u);
    }

    const result = [];
    for (const [id, { name, referrals }] of sponsorMap.entries()) {
      const referrals30d = referrals.filter((r) => r.created_at >= cutoff30).length;
      if (!referrals30d) continue;
      const referralsPrev = referrals.filter((r) => r.created_at >= cutoff60 && r.created_at < cutoff30).length;
      const activeReferrals = referrals.filter((r) => r.adhesion_at).length;
      result.push({
        id, name, referrals30d, referralsPrev,
        totalReferrals: referrals.length, activeReferrals,
        conversionPct: referrals.length > 0 ? Math.round((activeReferrals / referrals.length) * 100) : 0,
        delta: referrals30d - referralsPrev,
      });
    }

    return result.sort((a, b) => b.referrals30d - a.referrals30d).slice(0, limit);
  }
  // ── Cashback ──────────────────────────────────────────────────────────────

  async listCashback(limit = 50, offset = 0): Promise<{ rows: AdminUserRow[]; total: number }> {
    // Busca usuários com adesão — tanto por adhesion_at quanto por adhesion_paid
    const { data, count } = await supabase
      .from('users')
      .select('id, name, email, plan_interest, referral_code, sponsor_id, adhesion_at, plan_monthly_cents, adhesion_value_cents, cashback_pct, created_at, adhesion_paid', { count: 'exact' })
      .not('plan_monthly_cents', 'is', null)
      .or('adhesion_at.not.is.null,adhesion_paid.eq.true')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    type CbRow = { plan_monthly_cents?: number; cashback_pct?: number | null; [key: string]: unknown };
    const rows = (data ?? []).map((r: CbRow) => ({
      ...r,
      // Prioriza cashback_pct definido pelo admin; fallback: calc automático
      cashback_pct: r.cashback_pct ?? ((r.plan_monthly_cents ?? 0) >= 1_000_000 ? 50 : 40),
    })) as AdminUserRow[];
    return { rows, total: count ?? 0 };
  }

  // ── Cashback Payments (mes a mes) ─────────────────────────────────────────

  async getCashbackPayments(userId: string): Promise<CashbackPaymentRow[]> {
    const { data } = await supabase
      .from('cashback_payments')
      .select('*')
      .eq('user_id', userId)
      .order('month_number', { ascending: true });
    return (data ?? []) as CashbackPaymentRow[];
  }

  async getCashbackPaymentsBulk(userIds: string[]): Promise<Record<string, number[]>> {
    if (userIds.length === 0) return {};
    const { data } = await supabase
      .from('cashback_payments')
      .select('user_id, month_number')
      .in('user_id', userIds);
    const map: Record<string, number[]> = {};
    for (const r of (data ?? []) as { user_id: string; month_number: number }[]) {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.month_number);
    }
    return map;
  }

  async markCashbackMonthPaid(
    userId: string,
    monthNumber: number,
    amountCents: number,
    paidBy: string
  ): Promise<void> {
    const { randomUUID } = await import('node:crypto');

    // 1. Registra o pagamento de cashback
    const { error } = await supabase.from('cashback_payments').upsert({
      id: randomUUID(),
      user_id: userId,
      month_number: monthNumber,
      amount_cents: amountCents,
      paid_at: new Date().toISOString(),
      paid_by: paidBy,
    }, { onConflict: 'user_id,month_number' });
    if (error) throw new Error(`[markCashbackMonthPaid] ${error.message}`);

    // 2. Gera comissões para a cadeia de sponsors
    const { data: userRow } = await supabase
      .from('users')
      .select('sponsor_id, plan_monthly_cents')
      .eq('id', userId)
      .maybeSingle();

    if (!userRow?.sponsor_id || !userRow.plan_monthly_cents) return;

    const planMonthly = userRow.plan_monthly_cents;
    const period = `cashback-m${monthNumber}`;
    const now = new Date().toISOString();

    /**
     * Mapa de níveis desbloqueados por carreira:
     * vendedor_elite: 1 (só direto N1)
     * supervisor:     2 (N1 + N2)
     * gestor:         3 (N1 + N2 + N3)
     * gerente_senior: 4 (N1 + N2 + N3 + N4)
     * diretor_geral:  5 (N1 + N2 + N3 + N4 + N5) — destrava TUDO
     */
    const UNLOCK: Record<string, number> = {
      vendedor_elite: 1,
      supervisor: 2,
      gestor: 3,
      gerente_senior: 4,
      diretor_geral: 5,
    };

    // Percorre a cadeia: nível 0 = direto, nível 1-4 = rede
    // Percentuais lidos da configuração do admin
    const commCfg = await configRepository.getCommissionConfig();
    const levelPcts = [
      commCfg.direct_pct / 100,  // N0: direto (ex: 10% → 0.10)
      commCfg.level1_pct / 100,  // N1
      commCfg.level2_pct / 100,  // N2
      commCfg.level3_pct / 100,  // N3
      commCfg.level4_pct / 100,  // N4
    ];

    let currentUserId = userId;
    for (let level = 0; level <= 4; level++) {
      const { data: parent } = await supabase
        .from('users')
        .select('sponsor_id')
        .eq('id', currentUserId)
        .maybeSingle();

      const sponsorId = parent?.sponsor_id;
      if (!sponsorId) break;

      // Nível 0 (direto): sempre gera 10% para o sponsor direto
      // Nível 1+ (rede): só gera se o sponsor tem carreira que desbloqueia esse nível
      if (level > 0) {
        // Busca carreira do sponsor (manual do admin tem prioridade)
        const { data: sponsorRow } = await supabase
          .from('users')
          .select('career')
          .eq('id', sponsorId)
          .maybeSingle();

        const career = sponsorRow?.career as string | null;
        // Nível de rede requerido: level 1 precisa de unlock >= 2, level 2 >= 3, etc.
        const requiredUnlock = level + 1;
        const sponsorUnlock = career ? (UNLOCK[career] ?? 1) : 1;

        if (sponsorUnlock < requiredUnlock) {
          // Sponsor não tem carreira suficiente — pula mas continua subindo
          currentUserId = sponsorId;
          continue;
        }
      }

      const pct = levelPcts[level] ?? 0;
      const commissionCents = Math.floor(planMonthly * pct);
      if (commissionCents <= 0) break;

      // Evita duplicata
      const { count: existing } = await supabase
        .from('commission_entries')
        .select('*', { count: 'exact', head: true })
        .eq('sponsor_id', sponsorId)
        .eq('referred_user_id', userId)
        .eq('period', period)
        .eq('level', level);

      if ((existing ?? 0) === 0) {
        await supabase.from('commission_entries').insert({
          id: randomUUID(),
          sponsor_id: sponsorId,
          referred_user_id: userId,
          type: level === 0 ? 'direct' : 'network',
          level,
          amount_cents: commissionCents,
          period,
          status: 'available',
          created_at: now,
        });
      }

      currentUserId = sponsorId;
    }
  }

  async unmarkCashbackMonthPaid(userId: string, monthNumber: number): Promise<void> {
    const { error } = await supabase
      .from('cashback_payments')
      .delete()
      .eq('user_id', userId)
      .eq('month_number', monthNumber);
    if (error) throw new Error(`[unmarkCashbackMonthPaid] ${error.message}`);

    // Remove comissões geradas para este período
    const period = `cashback-m${monthNumber}`;
    await supabase
      .from('commission_entries')
      .delete()
      .eq('referred_user_id', userId)
      .eq('period', period);
  }

  /**
   * Recalcula comissões NÃO PAGAS de um usuário baseado no novo plan_monthly_cents.
   * Comissões já pagas (status = 'paid') são preservadas intactas.
   *
   * Recalcula em AMBAS as direções:
   * 1. referred_user_id = userId → comissões que os UPLINES deste usuário ganham
   * 2. sponsor_id = userId → comissões que ESTE USUÁRIO ganha dos seus indicados
   *    (quando o indicado tem valores atualizados)
   */
  async recalculateUserCommissions(userId: string, newMonthlyCents: number): Promise<void> {
    console.log(`[recalculateUserCommissions] userId=${userId}, newMonthlyCents=${newMonthlyCents}`);

    // ── 1. Comissões onde este usuário é o REFERIDO (uplines ganham dele) ──
    const { data: asReferred, error: errRef } = await supabase
      .from('commission_entries')
      .select('id, level, amount_cents, status')
      .eq('referred_user_id', userId)
      .neq('status', 'paid');

    console.log(`[recalculateUserCommissions] as referred: ${asReferred?.length ?? 0} entries, error: ${errRef?.message ?? 'none'}`);

    if (asReferred && asReferred.length > 0) {
      const commCfg = await configRepository.getCommissionConfig();
      const levelPcts = [
        commCfg.direct_pct / 100,
        commCfg.level1_pct / 100,
        commCfg.level2_pct / 100,
        commCfg.level3_pct / 100,
        commCfg.level4_pct / 100,
      ];

      for (const entry of asReferred as { id: string; level: number; amount_cents: number; status: string }[]) {
        const pct = levelPcts[entry.level] ?? 0;
        const newAmountCents = Math.floor(newMonthlyCents * pct);
        console.log(`[recalculateUserCommissions] entry ${entry.id}: level=${entry.level}, old=${entry.amount_cents}, new=${newAmountCents}, status=${entry.status}`);
        if (newAmountCents <= 0) {
          await supabase.from('commission_entries').delete().eq('id', entry.id);
        } else if (newAmountCents !== entry.amount_cents) {
          await supabase
            .from('commission_entries')
            .update({ amount_cents: newAmountCents })
            .eq('id', entry.id);
        }
      }
    }

    // ── 2. Comissões onde este usuário é o SPONSOR (ele ganha dos indicados) ──
    // Para cada indicado direto deste sponsor, busca o plan_monthly_cents atualizado
    // e recalcula as comissões diretas não pagas
    const { data: asSponsor, error: errSp } = await supabase
      .from('commission_entries')
      .select('id, level, amount_cents, referred_user_id, status')
      .eq('sponsor_id', userId)
      .neq('status', 'paid');

    console.log(`[recalculateUserCommissions] as sponsor: ${asSponsor?.length ?? 0} entries, error: ${errSp?.message ?? 'none'}`);

    if (asSponsor && asSponsor.length > 0) {
      // Busca plan_monthly_cents de cada referido único
      const referredIds = [...new Set(asSponsor.map((e) => (e as { referred_user_id: string }).referred_user_id))];
      const { data: referredUsers } = await supabase
        .from('users')
        .select('id, plan_monthly_cents')
        .in('id', referredIds);

      const monthlyMap: Record<string, number> = {};
      for (const u of (referredUsers ?? []) as { id: string; plan_monthly_cents: number | null }[]) {
        monthlyMap[u.id] = u.plan_monthly_cents ?? 0;
      }

      const commCfg = await configRepository.getCommissionConfig();
      const levelPcts = [
        commCfg.direct_pct / 100,
        commCfg.level1_pct / 100,
        commCfg.level2_pct / 100,
        commCfg.level3_pct / 100,
        commCfg.level4_pct / 100,
      ];

      for (const entry of asSponsor as { id: string; level: number; amount_cents: number; referred_user_id: string; status: string }[]) {
        const referredMonthly = monthlyMap[entry.referred_user_id] ?? 0;
        const pct = levelPcts[entry.level] ?? 0;
        const newAmountCents = Math.floor(referredMonthly * pct);
        console.log(`[recalculateUserCommissions] sponsor entry ${entry.id}: referred=${entry.referred_user_id}, monthly=${referredMonthly}, level=${entry.level}, old=${entry.amount_cents}, new=${newAmountCents}`);
        if (newAmountCents <= 0) {
          await supabase.from('commission_entries').delete().eq('id', entry.id);
        } else if (newAmountCents !== entry.amount_cents) {
          await supabase
            .from('commission_entries')
            .update({ amount_cents: newAmountCents })
            .eq('id', entry.id);
        }
      }
    }

    console.log(`[recalculateUserCommissions] done for userId=${userId}`);
  }

  // ── Financeiro / Extrato ──────────────────────────────────────────────────

  async totalRevenueCents(): Promise<number> {
    const { data } = await supabase.from('payments').select('amount_cents');
    return (data ?? []).reduce((s: number, r: { amount_cents: number }) => s + (r.amount_cents ?? 0), 0);
  }

  async paymentStatsByPeriod(): Promise<{ period: string; total: number; count: number }[]> {
    const { data } = await supabase.from('payments').select('period, amount_cents').order('period', { ascending: false });
    const map: Record<string, { total: number; count: number }> = {};
    type PeriodRow = { period: string; amount_cents: number };
    for (const r of (data ?? []) as PeriodRow[]) {
      if (!map[r.period]) map[r.period] = { total: 0, count: 0 };
      map[r.period].total += r.amount_cents ?? 0;
      map[r.period].count += 1;
    }
    return Object.entries(map).map(([period, v]) => ({ period, ...v }));
  }

  async totalCommissionsCents(): Promise<number> {
    const { data } = await supabase.from('commission_entries').select('amount_cents');
    return (data ?? []).reduce((s: number, r: { amount_cents: number }) => s + (r.amount_cents ?? 0), 0);
  }

  async commissionsByType(): Promise<{ type: string; total: number; count: number }[]> {
    const { data } = await supabase.from('commission_entries').select('type, amount_cents');
    const map: Record<string, { total: number; count: number }> = {};
    type TypeRow = { type: string; amount_cents: number };
    for (const r of (data ?? []) as TypeRow[]) {
      if (!map[r.type]) map[r.type] = { total: 0, count: 0 };
      map[r.type].total += r.amount_cents ?? 0;
      map[r.type].count += 1;
    }
    return Object.entries(map).map(([type, v]) => ({ type, ...v }));
  }

  // ── Rede / Stats ───────────────────────────────────────────────────────────

  async getNetworkStats(): Promise<{
    totalNodes: number; totalBases: number; avgDepth: number; maxDepth: number;
    totalUsers: number; withSponsor: number; withAdhesion: number;
  }> {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { data: withSponsorData } = await supabase.from('users').select('sponsor_id').not('sponsor_id', 'is', null);
    // "Com Adesão" = adhesion_paid true OU adhesion_at preenchido (retrocompatibilidade)
    const { count: withAdhesionCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('adhesion_paid', true);
    const uniqueSponsors = new Set((withSponsorData ?? []).map((r: { sponsor_id: string }) => r.sponsor_id)).size;
    return {
      totalNodes: totalUsers ?? 0,
      totalBases: uniqueSponsors,
      avgDepth: 0,
      maxDepth: 0,
      totalUsers: totalUsers ?? 0,
      withSponsor: (withSponsorData ?? []).length,
      withAdhesion: withAdhesionCount ?? 0,
    };
  }

  async countNetworkBases(): Promise<number> {
    const { data } = await supabase.from('users').select('sponsor_id').not('sponsor_id', 'is', null);
    return new Set((data ?? []).map((r: { sponsor_id: string }) => r.sponsor_id)).size;
  }

  // ── Saques (alias) ────────────────────────────────────────────────────────

  async updateWithdrawalStatus(
    id: string,
    status: 'approved' | 'rejected',
    processedBy: string,
    note?: string
  ): Promise<void> {
    await supabase.from('withdrawal_requests').update({
      status,
      reviewed_by: processedBy,
      reviewed_at: new Date().toISOString(),
      ...(note ? { review_note: note } : {}),
    }).eq('id', id);
  }

  // ── Comissões com filtro de status ────────────────────────────────────────

  async listCommissionsFiltered(
    statusFilter = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: CommissionRow[]; total: number }> {
    let q = supabase
      .from('commission_entries')
      .select('*, sponsor:users!sponsor_id(name), referred:users!referred_user_id(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const { data, count } = await q;
    type CommEntryFiltered = { sponsor?: { name: string }; referred?: { name: string }; [key: string]: unknown };
    const rows = (data ?? []).map((r: CommEntryFiltered) => ({
      ...r,
      sponsor_name: r.sponsor?.name ?? '',
      referred_name: r.referred?.name ?? '',
    })) as CommissionRow[];
    return { rows, total: count ?? 0 };
  }

  // ── Comissão: atualizar status ─────────────────────────────────────────────

  async updateCommissionStatus(commissionId: string, status: 'available' | 'paid' | 'withdrawn'): Promise<void> {
    const { error } = await supabase
      .from('commission_entries')
      .update({ status })
      .eq('id', commissionId);
    if (error) throw new Error(`[updateCommissionStatus] ${error.message}`);
  }
}

export const adminRepository = new AdminRepository();

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function previousPeriod(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}
