import 'server-only';

import { randomUUID } from 'node:crypto';
import { execute, query, queryOne, withTransaction } from '@/src/server/db/postgres';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '@/src/server/security/password';
import type { AdminRole, AdminUser, AuthenticatedAdminUser } from './admin.types';

export type PlanRow = {
  id: string;
  name: string;
  monthly_cents: number;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
};

export type CommissionConfig = {
  direct_pct: number;
  level1_pct: number;
  level2_pct: number;
  level3_pct: number;
  level4_pct: number;
};

export type CashbackConfig = {
  standard_pct: number;
  premium_pct: number;
  premium_threshold_cents: number;
  duration_months: number;
  credit_day: number;
};

type AdminCredentialRow = AdminUser & {
  password_hash: string;
  token_version: number;
};

const INVALID_PASSWORD_HASH =
  'scrypt$131072$8$1$YXhlLXByaW1lLWR1bW15IQ$O1nBRUKtP8dLBZlFQUvekcm827Wp8VWvKZRZLIkfl0gKuz9e8HlwM8lBW-kLJk1yzy5WevpkHkmf7Unbssnzbg';

const ADMIN_ROLES: readonly AdminRole[] = ['master', 'financeiro', 'suporte'];

function assertAdminRole(role: string): asserts role is AdminRole {
  if (!ADMIN_ROLES.includes(role as AdminRole)) {
    throw new Error('Cargo administrativo inválido.');
  }
}

function toNumber(value: string | number | null | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function assertPercentage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} deve estar entre 0 e 100.`);
  }
}

function assertAdminIdentity(name: string, email: string): void {
  if (name.trim().length < 2) throw new Error('Nome administrativo inválido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('E-mail administrativo inválido.');
  }
}

function normalizeAdminPassword(password: string): string {
  const normalized = password.normalize('NFC');
  const length = Array.from(normalized).length;
  if (length < 15 || length > 128) {
    throw new Error('A senha deve ter entre 15 e 128 caracteres.');
  }
  return normalized;
}

class ConfigRepository {
  private async getConfigValues(keys: readonly string[]): Promise<Map<string, string>> {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value
         FROM public.platform_config
        WHERE key = ANY($1::text[])`,
      [keys]
    );
    return new Map(rows.map(row => [row.key, row.value]));
  }

  private async setConfigEntries(entries: readonly (readonly [string, string])[]): Promise<void> {
    await withTransaction(async client => {
      for (const [key, value] of entries) {
        await client.query(
          `INSERT INTO public.platform_config (key, value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value,
                 updated_at = EXCLUDED.updated_at`,
          [key, value]
        );
      }
    });
  }

  async getPlans(): Promise<PlanRow[]> {
    return query<PlanRow>(
      `SELECT id, name, monthly_cents
         FROM public.plans
        ORDER BY monthly_cents ASC`
    );
  }

  async updatePlan(id: string, name: string, monthlyCents: number): Promise<void> {
    if (!id || name.trim().length < 2 || !Number.isSafeInteger(monthlyCents) || monthlyCents <= 0) {
      throw new Error('Dados do plano inválidos.');
    }
    const changed = await execute(
      `UPDATE public.plans
          SET name = $2,
              monthly_cents = $3
        WHERE id = $1`,
      [id, name, monthlyCents]
    );
    if (changed !== 1) throw new Error('Plano não encontrado.');
  }

  async getCommissionConfig(): Promise<CommissionConfig> {
    const values = await this.getConfigValues([
      'commission_direct_pct',
      'commission_level1_pct',
      'commission_level2_pct',
      'commission_level3_pct',
      'commission_level4_pct',
    ]);
    return {
      direct_pct: toNumber(values.get('commission_direct_pct'), 10),
      level1_pct: toNumber(values.get('commission_level1_pct'), 2),
      level2_pct: toNumber(values.get('commission_level2_pct'), 1),
      level3_pct: toNumber(values.get('commission_level3_pct'), 0.5),
      level4_pct: toNumber(values.get('commission_level4_pct'), 0),
    };
  }

  async setCommissionConfig(config: CommissionConfig): Promise<void> {
    for (const [label, value] of Object.entries(config)) {
      assertPercentage(value, label);
    }
    await this.setConfigEntries([
      ['commission_direct_pct', String(config.direct_pct)],
      ['commission_level1_pct', String(config.level1_pct)],
      ['commission_level2_pct', String(config.level2_pct)],
      ['commission_level3_pct', String(config.level3_pct)],
      ['commission_level4_pct', String(config.level4_pct)],
    ]);
  }

  async getCashbackConfig(): Promise<CashbackConfig> {
    const values = await this.getConfigValues([
      'cashback_standard_pct',
      'cashback_premium_pct',
      'cashback_premium_threshold_cents',
      'cashback_duration_months',
      'cashback_credit_day',
    ]);
    return {
      standard_pct: toNumber(values.get('cashback_standard_pct'), 40),
      premium_pct: toNumber(values.get('cashback_premium_pct'), 50),
      premium_threshold_cents: toNumber(values.get('cashback_premium_threshold_cents'), 1_000_000),
      duration_months: toNumber(values.get('cashback_duration_months'), 12),
      credit_day: toNumber(values.get('cashback_credit_day'), 16),
    };
  }

  async setCashbackConfig(config: CashbackConfig): Promise<void> {
    assertPercentage(config.standard_pct, 'Cashback padrão');
    assertPercentage(config.premium_pct, 'Cashback premium');
    if (
      !Number.isSafeInteger(config.premium_threshold_cents) ||
      config.premium_threshold_cents < 0
    ) {
      throw new Error('Limite premium inválido.');
    }
    if (
      !Number.isSafeInteger(config.duration_months) ||
      config.duration_months < 1 ||
      config.duration_months > 12
    ) {
      throw new Error('A duração do cashback deve estar entre 1 e 12 meses.');
    }
    if (
      !Number.isSafeInteger(config.credit_day) ||
      config.credit_day < 1 ||
      config.credit_day > 31
    ) {
      throw new Error('Dia de crédito inválido.');
    }
    await this.setConfigEntries([
      ['cashback_standard_pct', String(config.standard_pct)],
      ['cashback_premium_pct', String(config.premium_pct)],
      ['cashback_premium_threshold_cents', String(config.premium_threshold_cents)],
      ['cashback_duration_months', String(config.duration_months)],
      ['cashback_credit_day', String(config.credit_day)],
    ]);
  }

  async getAdminUsers(): Promise<AdminUserRow[]> {
    return query<AdminUserRow>(
      `SELECT id,
              name,
              email,
              role,
              active,
              created_at::text AS created_at,
              last_login_at::text AS last_login_at
         FROM public.admin_users
        ORDER BY created_at ASC`
    );
  }

  async addAdminUser(name: string, email: string, password: string, role: string): Promise<void> {
    assertAdminRole(role);
    assertAdminIdentity(name, email);
    const passwordHash = await hashPassword(normalizeAdminPassword(password));
    await execute(
      `INSERT INTO public.admin_users
         (id, name, email, password_hash, role, active, password_changed_at)
       VALUES ($1, $2, lower(btrim($3)), $4, $5, TRUE, NOW())`,
      [randomUUID(), name.trim(), email, passwordHash, role]
    );
  }

  async updateAdminUser(
    id: string,
    name: string,
    email: string,
    password: string | null,
    role: string,
    active: boolean
  ): Promise<void> {
    assertAdminRole(role);
    assertAdminIdentity(name, email);
    const nextPasswordHash = password ? await hashPassword(normalizeAdminPassword(password)) : null;

    await withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('axe-prime:admin-master-guard'))");
      const currentResult = await client.query<{
        role: AdminRole;
        active: boolean;
      }>(
        `SELECT role, active
           FROM public.admin_users
          WHERE id = $1
          FOR UPDATE`,
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) throw new Error('Administrador não encontrado.');

      if (current.role === 'master' && current.active && (role !== 'master' || !active)) {
        const masters = await client.query<{ total: number }>(
          `SELECT COUNT(*)::integer AS total
             FROM public.admin_users
            WHERE role = 'master' AND active = TRUE`
        );
        if ((masters.rows[0]?.total ?? 0) <= 1) {
          throw new Error('É necessário manter ao menos um Master ativo.');
        }
      }

      const authorizationChanged =
        current.role !== role || current.active !== active || Boolean(nextPasswordHash);

      await client.query(
        `UPDATE public.admin_users
            SET name = $2,
                email = lower(btrim($3)),
                role = $4,
                active = $5,
                password_hash = COALESCE($6, password_hash),
                password_changed_at = CASE WHEN $6::text IS NULL
                                           THEN password_changed_at ELSE NOW() END,
                token_version = token_version + CASE WHEN $7 THEN 1 ELSE 0 END
          WHERE id = $1`,
        [id, name.trim(), email, role, active, nextPasswordHash, authorizationChanged]
      );

      if (authorizationChanged) {
        await client.query(
          `UPDATE public.auth_sessions
              SET revoked_at = COALESCE(revoked_at, NOW()),
                  revoke_reason = COALESCE(revoke_reason, 'admin-account-updated')
            WHERE admin_user_id = $1
              AND revoked_at IS NULL`,
          [id]
        );
        await client.query(
          `UPDATE public.auth_refresh_tokens AS token
              SET revoked_at = COALESCE(token.revoked_at, NOW())
             FROM public.auth_sessions AS session
            WHERE token.session_id = session.id
              AND session.admin_user_id = $1
              AND token.revoked_at IS NULL`,
          [id]
        );
      }
    });
  }

  async deleteAdminUser(id: string): Promise<void> {
    await withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('axe-prime:admin-master-guard'))");
      const targetResult = await client.query<{ role: AdminRole; active: boolean }>(
        `SELECT role, active
           FROM public.admin_users
          WHERE id = $1
          FOR UPDATE`,
        [id]
      );
      const target = targetResult.rows[0];
      if (!target) throw new Error('Administrador não encontrado.');

      if (target.role === 'master' && target.active) {
        const masters = await client.query<{ total: number }>(
          `SELECT COUNT(*)::integer AS total
             FROM public.admin_users
            WHERE role = 'master' AND active = TRUE`
        );
        if ((masters.rows[0]?.total ?? 0) <= 1) {
          throw new Error('É necessário manter ao menos um Master ativo.');
        }
      }

      await client.query('DELETE FROM public.admin_users WHERE id = $1', [id]);
    });
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<AuthenticatedAdminUser | null> {
    const row = await queryOne<AdminCredentialRow>(
      `SELECT id, name, email, role, password_hash, token_version
         FROM public.admin_users
        WHERE lower(btrim(email)) = lower(btrim($1))
          AND active = TRUE
        LIMIT 1`,
      [email]
    );

    const valid = await verifyPassword(password, row?.password_hash ?? INVALID_PASSWORD_HASH);
    if (!row || !valid) return null;

    if (passwordNeedsRehash(row.password_hash)) {
      const upgraded = await hashPassword(password);
      await execute(
        `UPDATE public.admin_users
            SET password_hash = $2
          WHERE id = $1
            AND password_hash = $3
            AND token_version = $4`,
        [row.id, upgraded, row.password_hash, row.token_version]
      );
    }

    await execute('UPDATE public.admin_users SET last_login_at = NOW() WHERE id = $1', [row.id]);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      tokenVersion: row.token_version,
    };
  }
}

export const configRepository = new ConfigRepository();
