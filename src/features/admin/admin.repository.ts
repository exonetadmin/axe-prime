import 'server-only';

import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  execute,
  postgresIntegerToSafeNumber,
  query,
  queryOne,
  withTransaction,
} from '@/src/server/db/postgres';
import { encodeAvatarUserId, trustedAvatarUrl } from '@/src/features/profile/avatar-url';
import { appendSecurityAuditEvent } from '@/src/server/security/audit-log';

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  plan_interest: string | null;
  referral_code: string | null;
  sponsor_id: string | null;
  adhesion_at: string | null;
  plan_monthly_cents: number | null;
  adhesion_value_cents: number | null;
  cashback_pct: number | null;
  is_active: boolean | null;
  created_at: string;
  career: string | null;
  adhesion_paid: boolean | null;
  monthly_status: 'paid' | 'overdue' | null;
};

export type AdminNetworkNode = {
  id: string;
  name: string;
  email: string;
  sponsor_id: string | null;
  adhesion_at: string | null;
  plan_interest: string | null;
  avatar_url: string | null;
  globalLevel: number;
  levelInBase: number;
  isNewBase: boolean;
  children: AdminNetworkNode[];
};

export type WithdrawalRequestRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount_cents: number;
  pix_key: string;
  pix_key_type: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  requested_at: string;
};

export type CommissionRow = {
  id: string;
  sponsor_id: string;
  sponsor_name: string;
  referred_user_id: string;
  referred_name: string;
  type: string;
  level: number;
  amount_cents: number;
  period: string;
  status: string;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  user_id: string;
  user_name: string;
  amount_cents: number;
  period: string;
  paid_at: string;
};

export type CashbackPaymentRow = {
  id: string;
  user_id: string;
  month_number: number;
  amount_cents: number;
  paid_at: string;
  paid_by: string | null;
};

type RawNetworkUser = {
  id: string;
  name: string;
  email: string;
  sponsor_id: string | null;
  adhesion_at: string | null;
  plan_interest: string | null;
  avatar_url: string | null;
};

const USER_COLUMNS = `
  id, name, email, phone, plan_interest, referral_code, sponsor_id,
  adhesion_at::text AS adhesion_at, plan_monthly_cents,
  adhesion_value_cents, cashback_pct, is_active,
  created_at::text AS created_at, career, adhesion_paid, monthly_status
`;

function safeLimit(value: number, maximum = 500): number {
  return Math.min(maximum, Math.max(1, Math.trunc(value) || 1));
}

function safeOffset(value: number): number {
  return Math.max(0, Math.trunc(value) || 0);
}

function configNumber(value: string | number | null | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function adminAvatarUrl(value: string | null, userId: string): string | null {
  const trusted = trustedAvatarUrl(value);
  if (!trusted) return null;
  const encodedUserId = encodeAvatarUserId(userId);
  if (!encodedUserId) return null;
  const queryIndex = trusted.indexOf('?');
  const version = queryIndex >= 0 ? trusted.slice(queryIndex) : '';
  return `/admin/avatars/${encodedUserId}${version}`;
}

function omitTotalCount<Row extends { total_count: number }>(
  record: Row
): Omit<Row, 'total_count'> {
  const { total_count, ...row } = record;
  void total_count;
  return row;
}

async function loadCommissionPercentages(client: PoolClient): Promise<number[]> {
  const result = await client.query<{ key: string; value: string }>(
    `SELECT key, value
       FROM public.platform_config
      WHERE key = ANY($1::text[])`,
    [
      [
        'commission_direct_pct',
        'commission_level1_pct',
        'commission_level2_pct',
        'commission_level3_pct',
        'commission_level4_pct',
      ],
    ]
  );
  const values = new Map(result.rows.map(row => [row.key, configNumber(row.value)]));
  return [
    values.get('commission_direct_pct') ?? 10,
    values.get('commission_level1_pct') ?? 2,
    values.get('commission_level2_pct') ?? 1,
    values.get('commission_level3_pct') ?? 0.5,
    values.get('commission_level4_pct') ?? 0,
  ];
}

async function recalculateCommissionsWithClient(
  client: PoolClient,
  userId: string,
  newMonthlyCents: number
): Promise<void> {
  const percentages = await loadCommissionPercentages(client);
  const asReferred = await client.query<{
    id: string;
    level: number;
    amount_cents: number;
  }>(
    `SELECT id, level, amount_cents
       FROM public.commission_entries
      WHERE referred_user_id = $1 AND status = 'available'
      FOR UPDATE`,
    [userId]
  );
  for (const entry of asReferred.rows) {
    const amount = Math.floor(newMonthlyCents * ((percentages[entry.level] ?? 0) / 100));
    if (amount <= 0) {
      await client.query('DELETE FROM public.commission_entries WHERE id = $1', [entry.id]);
    } else if (amount !== entry.amount_cents) {
      await client.query('UPDATE public.commission_entries SET amount_cents = $2 WHERE id = $1', [
        entry.id,
        amount,
      ]);
    }
  }

  const asSponsor = await client.query<{
    id: string;
    level: number;
    amount_cents: number;
    plan_monthly_cents: number | null;
  }>(
    `SELECT commission.id,
            commission.level,
            commission.amount_cents,
            referred.plan_monthly_cents
       FROM public.commission_entries AS commission
       JOIN public.users AS referred ON referred.id = commission.referred_user_id
      WHERE commission.sponsor_id = $1
        AND commission.status = 'available'
      FOR UPDATE OF commission`,
    [userId]
  );
  for (const entry of asSponsor.rows) {
    const amount = Math.floor(
      (entry.plan_monthly_cents ?? 0) * ((percentages[entry.level] ?? 0) / 100)
    );
    if (amount <= 0) {
      await client.query('DELETE FROM public.commission_entries WHERE id = $1', [entry.id]);
    } else if (amount !== entry.amount_cents) {
      await client.query('UPDATE public.commission_entries SET amount_cents = $2 WHERE id = $1', [
        entry.id,
        amount,
      ]);
    }
  }
}

export class AdminRepository {
  async listUsers(
    search = '',
    limit = 50,
    offset = 0
  ): Promise<{ rows: AdminUserRow[]; total: number }> {
    const term = search.trim();
    const filter = term ? `WHERE name ILIKE $1 OR email ILIKE $1 OR referral_code ILIKE $1` : '';
    const values: unknown[] = term ? [`%${term}%`] : [];
    const limitIndex = values.push(safeLimit(limit));
    const offsetIndex = values.push(safeOffset(offset));

    const rows = await query<AdminUserRow & { total_count: number }>(
      `SELECT ${USER_COLUMNS}, COUNT(*) OVER()::integer AS total_count
         FROM public.users
         ${filter}
        ORDER BY created_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
    return {
      rows: rows.map(record => {
        const row = omitTotalCount(record);
        return { ...row, cashback_pct: row.cashback_pct ?? 40 };
      }),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async countUsersByPlan(): Promise<{ plan: string; count: number }[]> {
    return query<{ plan: string; count: number }>(
      `SELECT COALESCE(plan_interest, 'sem_plano') AS plan,
              COUNT(*)::integer AS count
         FROM public.users
        GROUP BY COALESCE(plan_interest, 'sem_plano')
        ORDER BY count DESC`
    );
  }

  async countActiveUsers(): Promise<number> {
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::integer AS count
         FROM public.users
        WHERE adhesion_paid = TRUE
          AND monthly_status IS DISTINCT FROM 'overdue'`
    );
    return row?.count ?? 0;
  }

  async updateUserPlan(
    userId: string,
    options: {
      plan: string;
      cashbackPct: number;
      adhesionValueCents: number | null;
      monthlyValueCents: number | null;
    }
  ): Promise<void> {
    await withTransaction(async client => {
      const changed = await client.query(
        `UPDATE public.users
            SET plan_interest = $2,
                cashback_pct = $3,
                plan_monthly_cents = $4,
                adhesion_value_cents = $5
          WHERE id = $1`,
        [
          userId,
          options.plan === 'sem_plano' ? null : options.plan,
          options.cashbackPct,
          options.monthlyValueCents,
          options.adhesionValueCents,
        ]
      );
      if ((changed.rowCount ?? 0) !== 1) throw new Error('Usuário não encontrado.');
      await recalculateCommissionsWithClient(client, userId, options.monthlyValueCents ?? 0);
    });
  }

  async updateUserCareer(userId: string, career: string | null): Promise<void> {
    const changed = await execute('UPDATE public.users SET career = $2 WHERE id = $1', [
      userId,
      career,
    ]);
    if (changed !== 1) throw new Error('Usuário não encontrado.');
  }

  async updateAdhesionPaid(userId: string, paid: boolean): Promise<void> {
    const changed = await execute(
      `UPDATE public.users
          SET adhesion_paid = $2,
              adhesion_at = CASE WHEN $2 THEN COALESCE(adhesion_at, NOW()) ELSE NULL END
        WHERE id = $1`,
      [userId, paid]
    );
    if (changed !== 1) throw new Error('Usuário não encontrado.');
  }

  async updateMonthlyStatus(userId: string, status: 'paid' | 'overdue' | null): Promise<void> {
    const changed = await execute('UPDATE public.users SET monthly_status = $2 WHERE id = $1', [
      userId,
      status,
    ]);
    if (changed !== 1) throw new Error('Usuário não encontrado.');
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
    const row = await queryOne<{
      active_users: number;
      pending_withdrawals: number;
      pending_plans: number;
      network_members: number;
      volume_month: string;
      paid_commissions: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::integer FROM public.users
           WHERE adhesion_paid = TRUE
             AND monthly_status IS DISTINCT FROM 'overdue') AS active_users,
         (SELECT COUNT(*)::integer FROM public.withdrawal_requests
           WHERE status = 'pending') AS pending_withdrawals,
         (SELECT COUNT(*)::integer FROM public.plan_requests
           WHERE status = 'pending') AS pending_plans,
         (SELECT COUNT(*)::integer FROM public.users
           WHERE sponsor_id IS NOT NULL) AS network_members,
         (SELECT COALESCE(SUM(amount_cents), 0)::text FROM public.payments
           WHERE period = $1) AS volume_month,
         (SELECT COALESCE(SUM(amount_cents), 0)::text FROM public.commission_entries
           WHERE status = 'paid') AS paid_commissions`,
      [period]
    );
    return {
      activeUsersCount: row?.active_users ?? 0,
      pendingWithdrawalsCount: row?.pending_withdrawals ?? 0,
      pendingPixAprovarCount: row?.pending_plans ?? 0,
      volumeMonthCents: postgresIntegerToSafeNumber(row?.volume_month, 'monthly revenue'),
      networkMembersCount: row?.network_members ?? 0,
      paidCommissionsCents: postgresIntegerToSafeNumber(
        row?.paid_commissions,
        'paid commission total'
      ),
    };
  }

  async listCommissions(limit = 50, offset = 0): Promise<{ rows: CommissionRow[]; total: number }> {
    return this.listCommissionsFiltered('all', limit, offset);
  }

  async listPayments(limit = 50, offset = 0): Promise<{ rows: PaymentRow[]; total: number }> {
    const rows = await query<PaymentRow & { total_count: number }>(
      `SELECT payment.id,
              payment.user_id,
              COALESCE(app_user.name, '') AS user_name,
              payment.amount_cents,
              payment.period,
              payment.paid_at::text AS paid_at,
              COUNT(*) OVER()::integer AS total_count
         FROM public.payments AS payment
         JOIN public.users AS app_user ON app_user.id = payment.user_id
        ORDER BY payment.created_at DESC
        LIMIT $1 OFFSET $2`,
      [safeLimit(limit), safeOffset(offset)]
    );
    return {
      rows: rows.map(omitTotalCount),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async listWithdrawals(
    status: 'pending' | 'approved' | 'rejected' | 'all' = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: WithdrawalRequestRow[]; total: number }> {
    const filtered = status !== 'all';
    const rows = await query<WithdrawalRequestRow & { total_count: number }>(
      `SELECT withdrawal.id,
              withdrawal.user_id,
              app_user.name AS user_name,
              app_user.email AS user_email,
              withdrawal.amount_cents,
              withdrawal.pix_key,
              withdrawal.pix_key_type,
              withdrawal.status,
              withdrawal.reviewed_by,
              withdrawal.reviewed_at::text AS reviewed_at,
              withdrawal.review_note,
              withdrawal.created_at::text AS created_at,
              withdrawal.requested_at::text AS requested_at,
              COUNT(*) OVER()::integer AS total_count
         FROM public.withdrawal_requests AS withdrawal
         JOIN public.users AS app_user ON app_user.id = withdrawal.user_id
        WHERE ($1::boolean = FALSE OR withdrawal.status = $2)
        ORDER BY withdrawal.created_at DESC
        LIMIT $3 OFFSET $4`,
      [filtered, filtered ? status : null, safeLimit(limit), safeOffset(offset)]
    );
    return {
      rows: rows.map(omitTotalCount),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async approveWithdrawal(id: string, processedBy: string, actorId: string): Promise<void> {
    await this.updateWithdrawalStatus(id, 'approved', processedBy, actorId);
  }

  async rejectWithdrawal(
    id: string,
    processedBy: string,
    actorId: string,
    note: string
  ): Promise<void> {
    await this.updateWithdrawalStatus(id, 'rejected', processedBy, actorId, note);
  }

  async getFullNetworkTree(rootId: string | null): Promise<AdminNetworkNode[]> {
    const users = await query<RawNetworkUser>(
      `SELECT id,
              name,
              email,
              sponsor_id,
              adhesion_at::text AS adhesion_at,
              plan_interest,
              avatar_url
         FROM public.users
        ORDER BY created_at ASC`
    );
    const userMap = new Map(users.map(user => [user.id, user]));
    const childrenMap = new Map<string, string[]>();
    for (const user of users) {
      if (!user.sponsor_id) continue;
      const children = childrenMap.get(user.sponsor_id) ?? [];
      children.push(user.id);
      childrenMap.set(user.sponsor_id, children);
    }

    const buildNode = (
      id: string,
      globalLevel: number,
      levelInBase: number,
      isNewBase: boolean,
      ancestors: ReadonlySet<string>
    ): AdminNetworkNode => {
      const raw = userMap.get(id);
      if (!raw) throw new Error(`Usuário da rede não encontrado: ${id}`);
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(id);
      const children = (childrenMap.get(id) ?? [])
        .filter(childId => !nextAncestors.has(childId))
        .map(childId => {
          const childStartsBase = levelInBase >= 5;
          return buildNode(
            childId,
            globalLevel + 1,
            childStartsBase ? 1 : levelInBase + 1,
            childStartsBase,
            nextAncestors
          );
        });
      return {
        ...raw,
        avatar_url: adminAvatarUrl(raw.avatar_url, raw.id),
        globalLevel,
        levelInBase,
        isNewBase,
        children,
      };
    };

    if (rootId) {
      return userMap.has(rootId) ? [buildNode(rootId, 0, 0, false, new Set())] : [];
    }
    const rootIds = users
      .filter(user => !user.sponsor_id || !userMap.has(user.sponsor_id))
      .map(user => user.id);
    return rootIds.map(id => buildNode(id, 0, 0, false, new Set()));
  }

  async getTopSponsors30d(limit = 10): Promise<
    {
      id: string;
      name: string;
      referrals30d: number;
      referralsPrev: number;
      totalReferrals: number;
      activeReferrals: number;
      conversionPct: number;
      delta: number;
    }[]
  > {
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * 86_400_000);
    const cutoff60 = new Date(now - 60 * 86_400_000);
    const rows = await query<{
      id: string;
      name: string;
      referrals_30d: number;
      referrals_prev: number;
      total_referrals: number;
      active_referrals: number;
    }>(
      `SELECT sponsor.id,
              sponsor.name,
              COUNT(referred.id) FILTER (
                WHERE referred.created_at >= $1
              )::integer AS referrals_30d,
              COUNT(referred.id) FILTER (
                WHERE referred.created_at >= $2 AND referred.created_at < $1
              )::integer AS referrals_prev,
              COUNT(referred.id)::integer AS total_referrals,
              COUNT(referred.id) FILTER (
                WHERE referred.adhesion_at IS NOT NULL OR referred.adhesion_paid = TRUE
              )::integer AS active_referrals
         FROM public.users AS sponsor
         JOIN public.users AS referred ON referred.sponsor_id = sponsor.id
        GROUP BY sponsor.id, sponsor.name
       HAVING COUNT(referred.id) FILTER (WHERE referred.created_at >= $1) > 0
        ORDER BY referrals_30d DESC, sponsor.name ASC
        LIMIT $3`,
      [cutoff30, cutoff60, safeLimit(limit, 100)]
    );
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      referrals30d: row.referrals_30d,
      referralsPrev: row.referrals_prev,
      totalReferrals: row.total_referrals,
      activeReferrals: row.active_referrals,
      conversionPct:
        row.total_referrals > 0
          ? Math.round((row.active_referrals / row.total_referrals) * 100)
          : 0,
      delta: row.referrals_30d - row.referrals_prev,
    }));
  }

  async listCashback(limit = 50, offset = 0): Promise<{ rows: AdminUserRow[]; total: number }> {
    const rows = await query<AdminUserRow & { total_count: number }>(
      `SELECT ${USER_COLUMNS}, COUNT(*) OVER()::integer AS total_count
         FROM public.users
        WHERE plan_monthly_cents IS NOT NULL
          AND (adhesion_at IS NOT NULL OR adhesion_paid = TRUE)
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [safeLimit(limit), safeOffset(offset)]
    );
    return {
      rows: rows.map(record => {
        const row = omitTotalCount(record);
        return {
          ...row,
          cashback_pct: row.cashback_pct ?? ((row.plan_monthly_cents ?? 0) >= 1_000_000 ? 50 : 40),
        };
      }),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async getCashbackPayments(userId: string): Promise<CashbackPaymentRow[]> {
    return query<CashbackPaymentRow>(
      `SELECT id,
              user_id,
              month_number,
              amount_cents,
              paid_at::text AS paid_at,
              paid_by
         FROM public.cashback_payments
        WHERE user_id = $1
        ORDER BY month_number ASC`,
      [userId]
    );
  }

  async getCashbackPaymentsBulk(userIds: string[]): Promise<Record<string, number[]>> {
    if (userIds.length === 0) return {};
    const rows = await query<{ user_id: string; month_number: number }>(
      `SELECT user_id, month_number
         FROM public.cashback_payments
        WHERE user_id = ANY($1::text[])
        ORDER BY user_id, month_number`,
      [userIds]
    );
    const result: Record<string, number[]> = {};
    for (const row of rows) {
      (result[row.user_id] ??= []).push(row.month_number);
    }
    return result;
  }

  async markCashbackMonthPaid(
    userId: string,
    monthNumber: number,
    paidBy: string,
    actorId: string
  ): Promise<void> {
    await withTransaction(async client => {
      const userResult = await client.query<{
        sponsor_id: string | null;
        plan_monthly_cents: number | null;
        cashback_pct: number;
        adhesion_paid: boolean;
        adhesion_at: string | null;
        is_active: boolean;
      }>(
        `SELECT sponsor_id, plan_monthly_cents, cashback_pct,
                adhesion_paid, adhesion_at::text AS adhesion_at, is_active
           FROM public.users
          WHERE id = $1
          FOR UPDATE`,
        [userId]
      );
      const user = userResult.rows[0];
      if (!user) throw new Error('Usuário não encontrado.');
      if (
        !user.is_active ||
        (!user.adhesion_paid && !user.adhesion_at) ||
        !user.plan_monthly_cents
      ) {
        throw new Error('Usuário não está elegível para cashback.');
      }
      const planMonthlyCents = user.plan_monthly_cents;
      const amountCents = Math.floor((planMonthlyCents * user.cashback_pct) / 100);
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new Error('Configuração de cashback inválida para este usuário.');
      }

      await client.query(
        `INSERT INTO public.cashback_payments
           (id, user_id, month_number, amount_cents, paid_at, paid_by)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT (user_id, month_number) DO UPDATE
           SET amount_cents = EXCLUDED.amount_cents,
               paid_at = EXCLUDED.paid_at,
               paid_by = EXCLUDED.paid_by`,
        [randomUUID(), userId, monthNumber, amountCents, paidBy]
      );
      await appendSecurityAuditEvent(client, {
        category: 'financial',
        action: 'cashback_month_paid',
        outcome: 'success',
        actorType: 'admin',
        actorId,
        subjectType: 'user',
        subjectId: userId,
        metadata: { monthNumber, amountCents },
      });

      if (!user.sponsor_id) return;
      const percentages = await loadCommissionPercentages(client);
      const period = `cashback-m${monthNumber}`;
      const unlockByCareer: Record<string, number> = {
        vendedor_elite: 1,
        supervisor: 2,
        gestor: 3,
        gerente_senior: 4,
        diretor_geral: 5,
      };

      let currentUserId = userId;
      for (let level = 0; level <= 4; level += 1) {
        const parentResult = await client.query<{
          sponsor_id: string | null;
          sponsor_career: string | null;
        }>(
          `SELECT child.sponsor_id,
                  sponsor.career AS sponsor_career
             FROM public.users AS child
             LEFT JOIN public.users AS sponsor ON sponsor.id = child.sponsor_id
            WHERE child.id = $1`,
          [currentUserId]
        );
        const parent = parentResult.rows[0];
        const sponsorId = parent?.sponsor_id;
        if (!sponsorId) break;

        if (level > 0) {
          const unlock = parent.sponsor_career ? (unlockByCareer[parent.sponsor_career] ?? 1) : 1;
          if (unlock < level + 1) {
            currentUserId = sponsorId;
            continue;
          }
        }

        const commissionCents = Math.floor(planMonthlyCents * ((percentages[level] ?? 0) / 100));
        if (commissionCents <= 0) break;
        await client.query(
          `INSERT INTO public.commission_entries
             (id, sponsor_id, referred_user_id, type, level,
              amount_cents, period, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'available')
           ON CONFLICT (sponsor_id, referred_user_id, period, level)
           DO NOTHING`,
          [
            randomUUID(),
            sponsorId,
            userId,
            level === 0 ? 'direct' : 'network',
            level,
            commissionCents,
            period,
          ]
        );
        currentUserId = sponsorId;
      }
    });
  }

  async unmarkCashbackMonthPaid(
    userId: string,
    monthNumber: number,
    actorId: string
  ): Promise<void> {
    await withTransaction(async client => {
      const period = `cashback-m${monthNumber}`;
      const commissions = await client.query<{ status: string }>(
        `SELECT status
           FROM public.commission_entries
          WHERE referred_user_id = $1
            AND period = $2
          FOR UPDATE`,
        [userId, period]
      );
      if (commissions.rows.some(commission => commission.status !== 'available')) {
        throw new Error('Não é possível desfazer um cashback com comissões já finalizadas.');
      }

      const deleted = await client.query(
        `DELETE FROM public.cashback_payments
          WHERE user_id = $1 AND month_number = $2`,
        [userId, monthNumber]
      );
      if ((deleted.rowCount ?? 0) !== 1) {
        throw new Error('Pagamento de cashback não encontrado.');
      }
      await client.query(
        `DELETE FROM public.commission_entries
          WHERE referred_user_id = $1
            AND period = $2`,
        [userId, period]
      );
      await appendSecurityAuditEvent(client, {
        category: 'financial',
        action: 'cashback_month_reverted',
        outcome: 'success',
        actorType: 'admin',
        actorId,
        subjectType: 'user',
        subjectId: userId,
        metadata: { monthNumber },
      });
    });
  }

  async recalculateUserCommissions(userId: string, newMonthlyCents: number): Promise<void> {
    await withTransaction(async client => {
      await recalculateCommissionsWithClient(client, userId, newMonthlyCents);
    });
  }

  async totalRevenueCents(): Promise<number> {
    const row = await queryOne<{ total: string }>(
      'SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM public.payments'
    );
    return postgresIntegerToSafeNumber(row?.total, 'revenue total');
  }

  async paymentStatsByPeriod(): Promise<{ period: string; total: number; count: number }[]> {
    const rows = await query<{ period: string; total: string; count: number }>(
      `SELECT period,
              COALESCE(SUM(amount_cents), 0)::text AS total,
              COUNT(*)::integer AS count
         FROM public.payments
        GROUP BY period
        ORDER BY period DESC`
    );
    return rows.map(row => ({
      ...row,
      total: postgresIntegerToSafeNumber(row.total, `payment total for ${row.period}`),
    }));
  }

  async totalCommissionsCents(): Promise<number> {
    const row = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::text AS total
         FROM public.commission_entries`
    );
    return postgresIntegerToSafeNumber(row?.total, 'commission total');
  }

  async commissionsByType(): Promise<{ type: string; total: number; count: number }[]> {
    const rows = await query<{ type: string; total: string; count: number }>(
      `SELECT type,
              COALESCE(SUM(amount_cents), 0)::text AS total,
              COUNT(*)::integer AS count
         FROM public.commission_entries
        GROUP BY type
        ORDER BY type`
    );
    return rows.map(row => ({
      ...row,
      total: postgresIntegerToSafeNumber(row.total, `commission total for ${row.type}`),
    }));
  }

  async getNetworkStats(): Promise<{
    totalNodes: number;
    totalBases: number;
    avgDepth: number;
    maxDepth: number;
    totalUsers: number;
    withSponsor: number;
    withAdhesion: number;
  }> {
    const row = await queryOne<{
      total_users: number;
      with_sponsor: number;
      total_bases: number;
      with_adhesion: number;
    }>(
      `SELECT COUNT(*)::integer AS total_users,
              COUNT(*) FILTER (WHERE sponsor_id IS NOT NULL)::integer AS with_sponsor,
              COUNT(DISTINCT sponsor_id) FILTER (
                WHERE sponsor_id IS NOT NULL
              )::integer AS total_bases,
              COUNT(*) FILTER (
                WHERE adhesion_paid = TRUE OR adhesion_at IS NOT NULL
              )::integer AS with_adhesion
         FROM public.users`
    );
    return {
      totalNodes: row?.total_users ?? 0,
      totalBases: row?.total_bases ?? 0,
      avgDepth: 0,
      maxDepth: 0,
      totalUsers: row?.total_users ?? 0,
      withSponsor: row?.with_sponsor ?? 0,
      withAdhesion: row?.with_adhesion ?? 0,
    };
  }

  async countNetworkBases(): Promise<number> {
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(DISTINCT sponsor_id)::integer AS count
         FROM public.users
        WHERE sponsor_id IS NOT NULL`
    );
    return row?.count ?? 0;
  }

  async updateWithdrawalStatus(
    id: string,
    status: 'approved' | 'rejected',
    processedBy: string,
    actorId: string,
    note?: string
  ): Promise<void> {
    await withTransaction(async client => {
      const changed = await client.query<{ user_id: string; amount_cents: number }>(
        `UPDATE public.withdrawal_requests
            SET status = $2,
                reviewed_by = $3,
                reviewed_at = NOW(),
                review_note = $4
          WHERE id = $1
            AND status = 'pending'
          RETURNING user_id, amount_cents`,
        [id, status, processedBy, note ?? null]
      );
      const withdrawal = changed.rows[0];
      if (!withdrawal) {
        throw new Error('Saque não encontrado ou já processado.');
      }
      await appendSecurityAuditEvent(client, {
        category: 'financial',
        action: status === 'approved' ? 'withdrawal_approved' : 'withdrawal_rejected',
        outcome: 'success',
        actorType: 'admin',
        actorId,
        subjectType: 'withdrawal_request',
        subjectId: id,
        metadata: { amountCents: withdrawal.amount_cents, userId: withdrawal.user_id },
      });
    });
  }

  async listCommissionsFiltered(
    statusFilter = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: CommissionRow[]; total: number }> {
    const filtered = statusFilter !== 'all';
    const rows = await query<CommissionRow & { total_count: number }>(
      `SELECT commission.id,
              commission.sponsor_id,
              sponsor.name AS sponsor_name,
              commission.referred_user_id,
              referred.name AS referred_name,
              commission.type,
              commission.level,
              commission.amount_cents,
              commission.period,
              commission.status,
              commission.created_at::text AS created_at,
              COUNT(*) OVER()::integer AS total_count
         FROM public.commission_entries AS commission
         JOIN public.users AS sponsor ON sponsor.id = commission.sponsor_id
         JOIN public.users AS referred ON referred.id = commission.referred_user_id
        WHERE ($1::boolean = FALSE OR commission.status = $2)
        ORDER BY commission.created_at DESC
        LIMIT $3 OFFSET $4`,
      [filtered, filtered ? statusFilter : null, safeLimit(limit), safeOffset(offset)]
    );
    return {
      rows: rows.map(omitTotalCount),
      total: rows[0]?.total_count ?? 0,
    };
  }

  async updateCommissionStatus(
    commissionId: string,
    status: 'available' | 'paid' | 'withdrawn',
    actorId: string
  ): Promise<void> {
    await withTransaction(async client => {
      const changed = await client.query<{ amount_cents: number; sponsor_id: string }>(
        `UPDATE public.commission_entries
            SET status = $2
          WHERE id = $1
          RETURNING amount_cents, sponsor_id`,
        [commissionId, status]
      );
      const commission = changed.rows[0];
      if (!commission) throw new Error('Comissão não encontrada.');
      await appendSecurityAuditEvent(client, {
        category: 'financial',
        action: 'commission_status_changed',
        outcome: 'success',
        actorType: 'admin',
        actorId,
        subjectType: 'commission_entry',
        subjectId: commissionId,
        metadata: {
          amountCents: commission.amount_cents,
          sponsorId: commission.sponsor_id,
          status,
        },
      });
    });
  }
}

export const adminRepository = new AdminRepository();

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
