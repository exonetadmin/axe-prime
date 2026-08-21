/** Plan requests repository. Database access is restricted to the server. */

import 'server-only';

import {
  execute,
  postgresIntegerToSafeNumber,
  query,
  queryOne,
  withTransaction,
} from '@/src/server/db/postgres';

type PgError = Error & { code?: string; constraint?: string };

export class PendingPlanRequestError extends Error {
  constructor() {
    super('Você já possui uma solicitação de plano em análise.');
    this.name = 'PendingPlanRequestError';
  }
}

export type PlanRequestType = 'onboarding' | 'plan_change';
export type PlanRequestStatus = 'pending' | 'approved' | 'rejected';
export type PlanInterest = 'start' | 'prime' | 'elite';

export type PlanRequestRow = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  type: PlanRequestType;
  status: PlanRequestStatus;
  requested_plan: PlanInterest;
  monthly_investment_cents: number;
  // KYC fields
  full_name: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issue_date: string | null;
  rg_issuer: string | null;
  birth_date: string | null;
  birth_state: string | null;
  birth_city: string | null;
  father_name: string | null;
  mother_name: string | null;
  profession: string | null;
  monthly_income_cents: number | null;
  patrimony_cents: number | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_city: string | null;
  address_state: string | null;
  phone: string | null;
  email: string | null;
  marital_status: string | null;
  // Legacy
  doc_type: string | null;
  doc_number: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type CreatePlanRequestData = {
  id: string;
  userId: string;
  type: PlanRequestType;
  requestedPlan: PlanInterest;
  monthlyInvestmentCents: number;
  // KYC fields
  fullName?: string;
  cpf?: string;
  rg?: string;
  rgIssueDate?: string;
  rgIssuer?: string;
  birthDate?: string;
  birthState?: string;
  birthCity?: string;
  fatherName?: string;
  motherName?: string;
  profession?: string;
  monthlyIncomeCents?: number;
  patrimonyCents?: number;
  addressCep?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressCity?: string;
  addressState?: string;
  phone?: string;
  email?: string;
  maritalStatus?: string;
  // Legacy
  docType?: string;
  docNumber?: string;
};

type PlanRequestDatabaseRow = Omit<PlanRequestRow, 'patrimony_cents'> & {
  patrimony_cents: string | null;
};

function mapPlanRequestRow(row: PlanRequestDatabaseRow): PlanRequestRow {
  return {
    ...row,
    patrimony_cents:
      row.patrimony_cents === null
        ? null
        : postgresIntegerToSafeNumber(row.patrimony_cents, 'declared patrimony'),
  };
}

function assertCents(
  value: number | undefined,
  label: string,
  maximum: number,
  strictlyPositive = false
): void {
  if (
    value === undefined ||
    !Number.isSafeInteger(value) ||
    value < (strictlyPositive ? 1 : 0) ||
    value > maximum
  ) {
    throw new Error(`${label} inválido.`);
  }
}

class PlanRequestsRepository {
  async createRequest(data: CreatePlanRequestData): Promise<void> {
    assertCents(data.monthlyInvestmentCents, 'Aporte mensal', 2_147_483_647, true);
    if (data.monthlyIncomeCents !== undefined) {
      assertCents(data.monthlyIncomeCents, 'Renda mensal', 2_147_483_647);
    }
    if (data.patrimonyCents !== undefined) {
      assertCents(data.patrimonyCents, 'Patrimônio', Number.MAX_SAFE_INTEGER);
    }

    try {
      await withTransaction(async client => {
        const user = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE',
          [data.userId]
        );
        if (!user.rows[0]) throw new Error('Usuário não encontrado ou desativado.');

        const pending = await client.query<{ id: string }>(
          `SELECT id
             FROM plan_requests
            WHERE user_id = $1 AND status = 'pending'
            LIMIT 1`,
          [data.userId]
        );
        if (pending.rows[0]) throw new PendingPlanRequestError();

        await client.query(
          `INSERT INTO plan_requests (
             id, user_id, type, status, requested_plan,
             monthly_investment_cents, full_name, cpf, rg, rg_issue_date,
             rg_issuer, birth_date, birth_state, birth_city, father_name,
             mother_name, profession, monthly_income_cents, patrimony_cents,
             address_cep, address_street, address_number, address_complement,
             address_city, address_state, phone, email, marital_status,
             doc_type, doc_number
           ) VALUES (
             $1, $2, $3, 'pending', $4,
             $5, $6, $7, $8, $9,
             $10, $11, $12, $13, $14,
             $15, $16, $17, $18,
             $19, $20, $21, $22,
             $23, $24, $25, $26, $27,
             $28, $29
           )`,
          [
            data.id,
            data.userId,
            data.type,
            data.requestedPlan,
            data.monthlyInvestmentCents,
            data.fullName ?? null,
            data.cpf ?? null,
            data.rg ?? null,
            data.rgIssueDate ?? null,
            data.rgIssuer ?? null,
            data.birthDate ?? null,
            data.birthState ?? null,
            data.birthCity ?? null,
            data.fatherName ?? null,
            data.motherName ?? null,
            data.profession ?? null,
            data.monthlyIncomeCents ?? null,
            data.patrimonyCents ?? null,
            data.addressCep ?? null,
            data.addressStreet ?? null,
            data.addressNumber ?? null,
            data.addressComplement ?? null,
            data.addressCity ?? null,
            data.addressState ?? null,
            data.phone ?? null,
            data.email ?? null,
            data.maritalStatus ?? null,
            data.docType ?? null,
            data.docNumber ?? null,
          ]
        );

        if (data.type === 'onboarding') {
          await client.query('UPDATE users SET kyc_submitted = TRUE WHERE id = $1', [data.userId]);
        }
      });
    } catch (error) {
      if (error instanceof PendingPlanRequestError) throw error;
      const pgError = error as PgError;
      if (
        pgError.code === '23505' &&
        pgError.constraint === 'ux_plan_requests_one_pending_per_user'
      ) {
        throw new PendingPlanRequestError();
      }
      throw error;
    }
  }

  async hasSubmittedKyc(userId: string): Promise<boolean> {
    const row = await queryOne<{ kyc_submitted: boolean }>(
      'SELECT kyc_submitted FROM users WHERE id = $1',
      [userId]
    );
    return row?.kyc_submitted === true;
  }

  async getUserPendingRequest(userId: string): Promise<PlanRequestRow | null> {
    const row = await queryOne<PlanRequestDatabaseRow>(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email
         FROM plan_requests pr
         JOIN users u ON u.id = pr.user_id
        WHERE pr.user_id = $1 AND pr.status = 'pending'
        ORDER BY pr.created_at DESC
        LIMIT 1`,
      [userId]
    );
    return row ? mapPlanRequestRow(row) : null;
  }

  async listRequests(
    status: PlanRequestStatus | 'all' = 'all',
    limit = 50,
    offset = 0
  ): Promise<{ rows: PlanRequestRow[]; total: number }> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    const safeOffset = Math.max(Math.trunc(offset), 0);
    const where = status === 'all' ? '' : 'WHERE pr.status = $1';
    const values = status === 'all' ? [safeLimit, safeOffset] : [status, safeLimit, safeOffset];
    const limitPosition = status === 'all' ? 1 : 2;

    const rows = await query<PlanRequestDatabaseRow & { total_count: string }>(
      `SELECT pr.*, u.name AS user_name, u.email AS user_email,
              COUNT(*) OVER()::TEXT AS total_count
         FROM plan_requests pr
         JOIN users u ON u.id = pr.user_id
         ${where}
        ORDER BY pr.created_at DESC
        LIMIT $${limitPosition} OFFSET $${limitPosition + 1}`,
      values
    );
    const total = postgresIntegerToSafeNumber(rows[0]?.total_count, 'plan request count');
    return {
      rows: rows.map(({ total_count, ...row }) => {
        void total_count;
        return mapPlanRequestRow(row);
      }),
      total,
    };
  }

  async countByStatus(): Promise<Record<PlanRequestStatus, number>> {
    const rows = await query<{ status: PlanRequestStatus; count: string }>(
      `SELECT status, COUNT(*)::TEXT AS count
         FROM plan_requests
        GROUP BY status`
    );
    const result: Record<PlanRequestStatus, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const row of rows) {
      result[row.status] = postgresIntegerToSafeNumber(row.count, `${row.status} request count`);
    }
    return result;
  }

  async approveRequest(id: string, reviewedBy: string): Promise<void> {
    await withTransaction(async client => {
      const fetched = await client.query<{
        user_id: string;
        requested_plan: PlanInterest;
        monthly_investment_cents: number;
        status: PlanRequestStatus;
      }>(
        `SELECT user_id, requested_plan, monthly_investment_cents, status
           FROM plan_requests
          WHERE id = $1
          FOR UPDATE`,
        [id]
      );
      const request = fetched.rows[0];
      if (!request) throw new Error('Solicitação não encontrada.');
      if (request.status !== 'pending') {
        throw new Error('Solicitação já foi revisada.');
      }

      await client.query(
        `UPDATE plan_requests
            SET status = 'approved', reviewed_by = $2,
                reviewed_at = NOW(), review_note = NULL
          WHERE id = $1`,
        [id, reviewedBy]
      );
      await client.query(
        `UPDATE users
            SET plan_interest = $2, plan_monthly_cents = $3,
                adhesion_value_cents = $3, kyc_submitted = TRUE
          WHERE id = $1`,
        [request.user_id, request.requested_plan, request.monthly_investment_cents]
      );
    });
  }

  async rejectRequest(id: string, reviewedBy: string, note: string): Promise<void> {
    const affected = await execute(
      `UPDATE plan_requests
          SET status = 'rejected', reviewed_by = $2,
              reviewed_at = NOW(), review_note = $3
        WHERE id = $1 AND status = 'pending'`,
      [id, reviewedBy, note]
    );
    if (affected !== 1) {
      throw new Error('Solicitação não encontrada ou já revisada.');
    }
  }
}

export const planRequestsRepository = new PlanRequestsRepository();
