import 'server-only';

import { randomUUID } from 'node:crypto';
import { execute, query, queryOne, withTransaction } from '@/src/server/db/postgres';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '@/src/server/security/password';
import {
  generateTotpSecret,
  encryptTotpSecret,
  decryptTotpSecret,
  encodeTotpUri,
  verifyTotpToken,
} from '@/src/server/security/totp';
import type { AdminRole, AdminUser, AdminUserWithMfa, AuthenticatedAdminUser } from './admin.types';
import { validatePasswordPolicy } from '@/lib/password-policy';
import { appendSecurityAuditEvent, type SecurityAuditEvent } from '@/src/server/security/audit-log';

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
  mfa_enabled: boolean;
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
  mfa_enabled: boolean;
  token_version: number;
};

type AdminTotpEnrollmentState = {
  mfa_enabled: boolean;
  mfa_secret_encrypted: string | null;
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

function normalizeAdminPassword(
  password: string,
  contextualValues: readonly string[] = []
): string {
  const normalized = password.normalize('NFC');
  const policyError = validatePasswordPolicy(normalized, contextualValues);
  if (policyError) throw new Error(policyError);
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

  private async setConfigEntries(
    entries: readonly (readonly [string, string])[],
    auditEvent?: SecurityAuditEvent
  ): Promise<void> {
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
      if (auditEvent) await appendSecurityAuditEvent(client, auditEvent);
    });
  }

  async getPlans(): Promise<PlanRow[]> {
    return query<PlanRow>(
      `SELECT id, name, monthly_cents
         FROM public.plans
        ORDER BY monthly_cents ASC`
    );
  }

  async updatePlan(
    id: string,
    name: string,
    monthlyCents: number,
    processedBy: string
  ): Promise<void> {
    if (!id || name.trim().length < 2 || !Number.isSafeInteger(monthlyCents) || monthlyCents <= 0) {
      throw new Error('Dados do plano inválidos.');
    }
    await withTransaction(async client => {
      const changed = await client.query(
        `UPDATE public.plans
            SET name = $2,
                monthly_cents = $3
          WHERE id = $1`,
        [id, name, monthlyCents]
      );
      if ((changed.rowCount ?? 0) !== 1) throw new Error('Plano não encontrado.');
      await appendSecurityAuditEvent(client, {
        category: 'configuration',
        action: 'plan_configuration_changed',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        subjectType: 'plan',
        subjectId: id,
        metadata: { monthlyCents },
      });
    });
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

  async setCommissionConfig(config: CommissionConfig, processedBy: string): Promise<void> {
    for (const [label, value] of Object.entries(config)) {
      assertPercentage(value, label);
    }
    await this.setConfigEntries(
      [
        ['commission_direct_pct', String(config.direct_pct)],
        ['commission_level1_pct', String(config.level1_pct)],
        ['commission_level2_pct', String(config.level2_pct)],
        ['commission_level3_pct', String(config.level3_pct)],
        ['commission_level4_pct', String(config.level4_pct)],
      ],
      {
        category: 'configuration',
        action: 'commission_configuration_changed',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        metadata: {
          directPct: config.direct_pct,
          level1Pct: config.level1_pct,
          level2Pct: config.level2_pct,
          level3Pct: config.level3_pct,
          level4Pct: config.level4_pct,
        },
      }
    );
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

  async setCashbackConfig(config: CashbackConfig, processedBy: string): Promise<void> {
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
    await this.setConfigEntries(
      [
        ['cashback_standard_pct', String(config.standard_pct)],
        ['cashback_premium_pct', String(config.premium_pct)],
        ['cashback_premium_threshold_cents', String(config.premium_threshold_cents)],
        ['cashback_duration_months', String(config.duration_months)],
        ['cashback_credit_day', String(config.credit_day)],
      ],
      {
        category: 'configuration',
        action: 'cashback_configuration_changed',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        metadata: {
          standardPct: config.standard_pct,
          premiumPct: config.premium_pct,
          premiumThresholdCents: config.premium_threshold_cents,
          durationMonths: config.duration_months,
          creditDay: config.credit_day,
        },
      }
    );
  }

  async getAdminUsers(): Promise<AdminUserRow[]> {
    return query<AdminUserRow>(
      `SELECT id,
              name,
              email,
              role,
              active,
              mfa_enabled,
              created_at::text AS created_at,
              last_login_at::text AS last_login_at
         FROM public.admin_users
        ORDER BY created_at ASC`
    );
  }

  async getSelfAdminMfaState(id: string): Promise<AdminUserWithMfa | null> {
    const row = await queryOne<AdminUser & { mfa_enabled: boolean }>(
      `SELECT id, name, email, role, mfa_enabled
         FROM public.admin_users
        WHERE id = $1
          AND active = TRUE
        LIMIT 1`,
      [id]
    );

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      mfaEnabled: row.mfa_enabled,
    };
  }

  async addAdminUser(
    name: string,
    email: string,
    password: string,
    role: string,
    processedBy: string
  ): Promise<void> {
    assertAdminRole(role);
    assertAdminIdentity(name, email);
    const passwordHash = await hashPassword(normalizeAdminPassword(password, [name, email]));
    await withTransaction(async client => {
      const id = randomUUID();
      await client.query(
        `INSERT INTO public.admin_users
           (id, name, email, password_hash, role, active, password_changed_at)
         VALUES ($1, $2, lower(btrim($3)), $4, $5, TRUE, NOW())`,
        [id, name.trim(), email, passwordHash, role]
      );
      await appendSecurityAuditEvent(client, {
        category: 'account',
        action: 'admin_account_created',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        subjectType: 'admin_user',
        subjectId: id,
        metadata: { role },
      });
    });
  }

  async updateAdminUser(
    id: string,
    name: string,
    email: string,
    password: string | null,
    role: string,
    active: boolean,
    processedBy: string
  ): Promise<void> {
    assertAdminRole(role);
    assertAdminIdentity(name, email);
    const nextPasswordHash = password
      ? await hashPassword(normalizeAdminPassword(password, [name, email]))
      : null;

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
      await appendSecurityAuditEvent(client, {
        category: 'account',
        action: 'admin_account_updated',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        subjectType: 'admin_user',
        subjectId: id,
        metadata: { role, active, credentialRotated: Boolean(nextPasswordHash) },
      });
    });
  }

  async deleteAdminUser(id: string, processedBy: string): Promise<void> {
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
      await appendSecurityAuditEvent(client, {
        category: 'account',
        action: 'admin_account_deleted',
        outcome: 'success',
        actorType: 'admin',
        actorId: processedBy,
        subjectType: 'admin_user',
        subjectId: id,
        metadata: { previousRole: target.role },
      });
    });
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<AuthenticatedAdminUser | null> {
    const row = await queryOne<AdminCredentialRow>(
      `SELECT id, name, email, role, password_hash, mfa_enabled, token_version
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
      mfaEnabled: row.mfa_enabled,
      tokenVersion: row.token_version,
    };
  }

  async initAdminTotpEnrollment(adminId: string): Promise<{ secret: string; otpauthUri: string }> {
    const row = await queryOne<AdminUser & { active: boolean }>(
      `SELECT id, name, email, role, active
         FROM public.admin_users
        WHERE id = $1
          AND active = TRUE
        LIMIT 1`,
      [adminId]
    );

    if (!row) {
      throw new Error('Administrador não encontrado.');
    }

    const secret = generateTotpSecret();
    const encrypted = encryptTotpSecret(secret);
    const otpauthUri = encodeTotpUri(row.email, secret);

    await withTransaction(async client => {
      await client.query(
        `UPDATE public.admin_users
            SET mfa_secret_encrypted = $2,
                mfa_enabled = FALSE,
                mfa_enabled_at = NULL
          WHERE id = $1
            AND active = TRUE`,
        [adminId, encrypted]
      );
    });

    return { secret, otpauthUri };
  }

  async getAdminTotpEnrollmentState(adminId: string): Promise<AdminTotpEnrollmentState | null> {
    return queryOne<AdminTotpEnrollmentState>(
      `SELECT mfa_enabled, mfa_secret_encrypted
         FROM public.admin_users
        WHERE id = $1
          AND active = TRUE
        LIMIT 1`,
      [adminId]
    );
  }

  async enableAdminTotp(adminId: string, token: string): Promise<void> {
    const state = await this.getAdminTotpEnrollmentState(adminId);
    if (!state?.mfa_secret_encrypted) {
      throw new Error('Configure o QR primeiro para gerar um segredo.');
    }

    const secret = decryptTotpSecret(state.mfa_secret_encrypted);
    if (!verifyTotpToken(secret, token)) {
      throw new Error('Token inválido.');
    }

    await withTransaction(async client => {
      const result = await client.query(
        `UPDATE public.admin_users
            SET mfa_enabled = TRUE,
                mfa_enabled_at = NOW(),
                token_version = token_version + 1
          WHERE id = $1
            AND active = TRUE`,
        [adminId]
      );
      if ((result.rowCount ?? 0) === 0) {
        throw new Error('Administrador não encontrado.');
      }

      await client.query(
        `UPDATE public.auth_sessions
            SET revoked_at = COALESCE(revoked_at, NOW()),
                revoke_reason = COALESCE(revoke_reason, 'admin_mfa_enabled')
          WHERE admin_user_id = $1
            AND revoked_at IS NULL`,
        [adminId]
      );

      await client.query(
        `UPDATE public.auth_refresh_tokens AS token
            SET revoked_at = COALESCE(token.revoked_at, NOW())
           FROM public.auth_sessions AS session
          WHERE token.session_id = session.id
            AND session.admin_user_id = $1
            AND token.revoked_at IS NULL`,
        [adminId]
      );

      await appendSecurityAuditEvent(client, {
        category: 'account',
        action: 'admin_mfa_enabled',
        outcome: 'success',
        actorType: 'admin',
        actorId: adminId,
      });
    });
  }

  async disableAdminTotp(adminId: string): Promise<void> {
    await withTransaction(async client => {
      const current = await client.query<{ token_version: number }>(
        `SELECT token_version
           FROM public.admin_users
          WHERE id = $1
            AND active = TRUE
          FOR UPDATE`,
        [adminId]
      );

      if (!current.rows[0]) {
        throw new Error('Administrador não encontrado.');
      }

      await client.query(
        `UPDATE public.admin_users
            SET mfa_enabled = FALSE,
                mfa_secret_encrypted = NULL,
                mfa_enabled_at = NULL,
                token_version = token_version + 1
          WHERE id = $1`,
        [adminId]
      );

      await client.query(
        `UPDATE public.auth_sessions
            SET revoked_at = COALESCE(revoked_at, NOW()),
                revoke_reason = COALESCE(revoke_reason, 'admin_mfa_disabled')
          WHERE admin_user_id = $1
            AND revoked_at IS NULL`,
        [adminId]
      );

      await client.query(
        `UPDATE public.auth_refresh_tokens AS token
            SET revoked_at = COALESCE(token.revoked_at, NOW())
           FROM public.auth_sessions AS session
          WHERE token.session_id = session.id
            AND session.admin_user_id = $1
            AND token.revoked_at IS NULL`,
        [adminId]
      );

      await appendSecurityAuditEvent(client, {
        category: 'account',
        action: 'admin_mfa_disabled',
        outcome: 'success',
        actorType: 'admin',
        actorId: adminId,
      });
    });
  }
}

export const configRepository = new ConfigRepository();
