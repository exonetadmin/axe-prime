/** Financial read model for the member portal. */

import 'server-only';

import { postgresIntegerToSafeNumber, query, queryOne } from '@/src/server/db/postgres';

const DEFAULT_DIRECT_COMMISSION_PCT = 10;
const DEFAULT_COMMISSION_MONTHS = 12;

type AdhesionRow = {
  adhesion_at: string | Date | null;
  plan_monthly_cents: number | null;
};

type SaleProjectionRow = {
  referred_user_id: string;
  referred_name: string;
  adhesion_at: string | Date;
  plan_monthly_cents: number;
  months_paid: string;
  total_paid_cents: string;
};

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function safeInteger(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '0', 10);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export class EarningsRepository {
  async getLastPaymentPeriod(userId: string): Promise<string | null> {
    const row = await queryOne<{ period: string | null }>(
      'SELECT MAX(period) AS period FROM payments WHERE user_id = $1',
      [userId]
    );
    return row?.period ?? null;
  }

  async getAdhesion(userId: string): Promise<{
    adhesionAt: string | null;
    planMonthlyCents: number;
  } | null> {
    const row = await queryOne<AdhesionRow>(
      `SELECT adhesion_at, plan_monthly_cents
         FROM users
        WHERE id = $1`,
      [userId]
    );
    if (!row) return null;
    return {
      adhesionAt: row.adhesion_at ? iso(row.adhesion_at) : null,
      planMonthlyCents: row.plan_monthly_cents ?? 0,
    };
  }

  async getDisponivelCents(userId: string): Promise<number> {
    const row = await queryOne<{ total_cents: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::TEXT AS total_cents
         FROM commission_entries
        WHERE sponsor_id = $1
          AND type = 'direct'
          AND status IN ('available', 'paid')`,
      [userId]
    );
    return postgresIntegerToSafeNumber(row?.total_cents, 'direct commission total');
  }

  async getAReceberCents(userId: string): Promise<number> {
    const sales = await this.getSalesWithProjection(userId);
    return sales.reduce((total, sale) => total + sale.totalAReceberCents, 0);
  }

  async getSalesWithProjection(userId: string): Promise<
    Array<{
      referredUserId: string;
      referredName: string;
      adhesionAt: string;
      planMonthlyCents: number;
      commissionPerMonthCents: number;
      monthsPaid: number;
      monthsRemaining: number;
      totalPaidCents: number;
      totalAReceberCents: number;
    }>
  > {
    const config = await queryOne<{
      direct_pct: string | null;
      duration_months: string | null;
    }>(
      `SELECT
         MAX(value) FILTER (WHERE key = 'commission_direct_pct') AS direct_pct,
         MAX(value) FILTER (WHERE key = 'cashback_duration_months') AS duration_months
       FROM platform_config
       WHERE key IN ('commission_direct_pct', 'cashback_duration_months')`
    );
    const directPct = safeInteger(config?.direct_pct) || DEFAULT_DIRECT_COMMISSION_PCT;
    const durationMonths = safeInteger(config?.duration_months) || DEFAULT_COMMISSION_MONTHS;

    const rows = await query<SaleProjectionRow>(
      `SELECT
         referred.id AS referred_user_id,
         referred.name AS referred_name,
         COALESCE(referred.adhesion_at, referred.created_at) AS adhesion_at,
         COALESCE(referred.plan_monthly_cents, 0)::INTEGER AS plan_monthly_cents,
         COUNT(entries.id)::TEXT AS months_paid,
         COALESCE(SUM(entries.amount_cents), 0)::TEXT AS total_paid_cents
       FROM users referred
       LEFT JOIN commission_entries entries
         ON entries.referred_user_id = referred.id
        AND entries.sponsor_id = $1
        AND entries.type = 'direct'
        AND entries.status IN ('available', 'paid')
       WHERE referred.sponsor_id = $1
         AND (referred.adhesion_paid = TRUE OR referred.adhesion_at IS NOT NULL)
       GROUP BY referred.id, referred.name, referred.adhesion_at,
                referred.created_at, referred.plan_monthly_cents
       ORDER BY COALESCE(referred.adhesion_at, referred.created_at) DESC`,
      [userId]
    );

    return rows.map(row => {
      const monthsPaid = Math.min(
        postgresIntegerToSafeNumber(row.months_paid, 'commission month count'),
        durationMonths
      );
      const monthsRemaining = Math.max(0, durationMonths - monthsPaid);
      const commissionPerMonthCents = Math.floor((row.plan_monthly_cents * directPct) / 100);
      return {
        referredUserId: row.referred_user_id,
        referredName: row.referred_name,
        adhesionAt: iso(row.adhesion_at),
        planMonthlyCents: row.plan_monthly_cents,
        commissionPerMonthCents,
        monthsPaid,
        monthsRemaining,
        totalPaidCents: postgresIntegerToSafeNumber(row.total_paid_cents, 'paid commission total'),
        totalAReceberCents: commissionPerMonthCents * monthsRemaining,
      };
    });
  }

  async getCashbackData(userId: string): Promise<{
    planMonthlyCents: number;
    percentual: number;
    adhesionAt: string | null;
  } | null> {
    const row = await queryOne<{
      plan_monthly_cents: number | null;
      cashback_pct: number;
      adhesion_at: string | Date | null;
      adhesion_paid: boolean;
    }>(
      `SELECT plan_monthly_cents, cashback_pct, adhesion_at, adhesion_paid
         FROM users
        WHERE id = $1`,
      [userId]
    );
    if (!row || (!row.adhesion_paid && !row.adhesion_at)) return null;
    return {
      planMonthlyCents: row.plan_monthly_cents ?? 0,
      percentual: row.cashback_pct,
      adhesionAt: row.adhesion_at ? iso(row.adhesion_at) : null,
    };
  }

  async getNetworkCommissionCents(userId: string): Promise<number> {
    const row = await queryOne<{ total_cents: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0)::TEXT AS total_cents
         FROM commission_entries
        WHERE sponsor_id = $1
          AND type = 'network'
          AND status IN ('available', 'paid')`,
      [userId]
    );
    return postgresIntegerToSafeNumber(row?.total_cents, 'network commission total');
  }
}

export const earningsRepository = new EarningsRepository();
