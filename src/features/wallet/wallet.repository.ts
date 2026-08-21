import 'server-only';

import {
  postgresIntegerToSafeNumber,
  query,
  queryOne,
  withTransaction,
} from '@/src/server/db/postgres';

export type WalletCashbackRow = {
  id: string;
  month_number: number;
  amount_cents: number;
  paid_at: string | Date;
};

export type WalletCommissionRow = {
  id: string;
  type: 'direct' | 'network';
  level: number;
  amount_cents: number;
  status: 'available' | 'paid' | 'withdrawn';
  period: string;
  created_at: string | Date;
  referred_user_id: string;
  referred_name: string;
};

export type WalletWithdrawalRow = {
  id: string;
  amount_cents: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string | Date;
};

export class WalletRepository {
  listCashbackPayments(userId: string): Promise<WalletCashbackRow[]> {
    return query<WalletCashbackRow>(
      `SELECT id, month_number, amount_cents, paid_at
         FROM cashback_payments
        WHERE user_id = $1
        ORDER BY paid_at DESC`,
      [userId]
    );
  }

  listCommissions(userId: string, limit = 100): Promise<WalletCommissionRow[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    return query<WalletCommissionRow>(
      `SELECT ce.id, ce.type, ce.level, ce.amount_cents, ce.status,
              ce.period, ce.created_at, ce.referred_user_id,
              COALESCE(u.name, 'Parceiro') AS referred_name
         FROM commission_entries ce
         LEFT JOIN users u ON u.id = ce.referred_user_id
        WHERE ce.sponsor_id = $1
        ORDER BY ce.created_at DESC
        LIMIT $2`,
      [userId, safeLimit]
    );
  }

  listWithdrawals(userId: string, limit = 50): Promise<WalletWithdrawalRow[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    return query<WalletWithdrawalRow>(
      `SELECT id, amount_cents, status, created_at
         FROM withdrawal_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, safeLimit]
    );
  }

  async hasValidCpf(userId: string): Promise<boolean> {
    const row = await queryOne<{ cpf: string | null }>('SELECT cpf FROM users WHERE id = $1', [
      userId,
    ]);
    return (row?.cpf ?? '').replace(/\D/g, '').length === 11;
  }

  /**
   * Checks the balance and creates the withdrawal under a per-user row lock.
   * This prevents two simultaneous requests from spending the same balance.
   */
  async createWithdrawal(userId: string, amountCents: number): Promise<{ netCents: number }> {
    return withTransaction(async client => {
      const userResult = await client.query<{ cpf: string | null }>(
        'SELECT cpf FROM users WHERE id = $1 AND is_active = TRUE FOR UPDATE',
        [userId]
      );
      const cpf = (userResult.rows[0]?.cpf ?? '').replace(/\D/g, '');
      if (cpf.length !== 11) {
        throw new WalletRuleError('CPF_REQUIRED', 'Cadastre seu CPF antes de solicitar saque.');
      }

      const balanceResult = await client.query<{ available_cents: string }>(
        `SELECT GREATEST(
           0,
           COALESCE((
             SELECT SUM(amount_cents) FROM cashback_payments WHERE user_id = $1
           ), 0)
           + COALESCE((
             SELECT SUM(amount_cents)
               FROM commission_entries
              WHERE sponsor_id = $1 AND status IN ('available', 'paid')
           ), 0)
           - COALESCE((
             SELECT SUM(amount_cents)
               FROM withdrawal_requests
              WHERE user_id = $1 AND status IN ('pending', 'approved')
           ), 0)
         )::TEXT AS available_cents`,
        [userId]
      );
      const availableCents = postgresIntegerToSafeNumber(
        balanceResult.rows[0]?.available_cents,
        'available wallet balance'
      );
      if (amountCents > availableCents) {
        throw new WalletRuleError('INSUFFICIENT_BALANCE', 'Saldo insuficiente.');
      }

      await client.query(
        `INSERT INTO withdrawal_requests (
           user_id, amount_cents, pix_key, pix_key_type, status
         ) VALUES ($1, $2, $3, 'cpf', 'pending')`,
        [userId, amountCents, cpf]
      );

      const feeCents = Math.round(amountCents * 0.06);
      return { netCents: amountCents - feeCents };
    });
  }
}

export class WalletRuleError extends Error {
  constructor(
    readonly code: 'CPF_REQUIRED' | 'INSUFFICIENT_BALANCE',
    message: string
  ) {
    super(message);
    this.name = 'WalletRuleError';
  }
}

export const walletRepository = new WalletRepository();
