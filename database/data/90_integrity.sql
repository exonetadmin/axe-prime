
-- ---------------------------------------------------------------------------
-- Constraints ausentes no schema legado
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.commission_entries
    WHERE level NOT BETWEEN 0 AND 4
  ) THEN
    RAISE EXCEPTION
      'commission_entries contém níveis fora do domínio 0..4; reconcilie antes da migration';
  END IF;
END
$migration$;

DO $migration$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT *
    FROM (VALUES
      ('public.users'::regclass, 'users_plan_interest_check',
        $constraint$CHECK (plan_interest IS NULL OR plan_interest IN ('start', 'prime', 'elite'))$constraint$),
      ('public.users'::regclass, 'users_career_check',
        $constraint$CHECK (career IS NULL OR career IN ('vendedor_elite', 'supervisor', 'gestor', 'gerente_senior', 'diretor_geral'))$constraint$),
      ('public.users'::regclass, 'users_monthly_status_check',
        $constraint$CHECK (monthly_status IS NULL OR monthly_status IN ('paid', 'overdue'))$constraint$),
      ('public.users'::regclass, 'users_cashback_pct_check',
        $constraint$CHECK (cashback_pct BETWEEN 0 AND 100)$constraint$),
      ('public.users'::regclass, 'users_plan_monthly_cents_check',
        $constraint$CHECK (plan_monthly_cents IS NULL OR plan_monthly_cents >= 0)$constraint$),
      ('public.users'::regclass, 'users_adhesion_value_cents_check',
        $constraint$CHECK (adhesion_value_cents IS NULL OR adhesion_value_cents >= 0)$constraint$),
      ('public.users'::regclass, 'users_token_version_check',
        $constraint$CHECK (token_version >= 0)$constraint$),
      ('public.users'::regclass, 'users_password_hash_check',
        $constraint$CHECK (length(password_hash) >= 20)$constraint$),
      ('public.users'::regclass, 'users_sponsor_not_self_check',
        $constraint$CHECK (sponsor_id IS NULL OR sponsor_id <> id)$constraint$),
      ('public.plans'::regclass, 'plans_id_check',
        $constraint$CHECK (id IN ('start', 'prime', 'elite'))$constraint$),
      ('public.plans'::regclass, 'plans_monthly_cents_check',
        $constraint$CHECK (monthly_cents >= 0)$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_monthly_investment_check',
        $constraint$CHECK (monthly_investment_cents >= 0)$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_type_check',
        $constraint$CHECK (type IN ('onboarding', 'plan_change'))$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_status_check',
        $constraint$CHECK (status IN ('pending', 'approved', 'rejected'))$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_requested_plan_check',
        $constraint$CHECK (requested_plan IN ('start', 'prime', 'elite'))$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_monthly_income_check',
        $constraint$CHECK (monthly_income_cents IS NULL OR monthly_income_cents >= 0)$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_patrimony_check',
        $constraint$CHECK (patrimony_cents IS NULL OR patrimony_cents >= 0)$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_marital_status_check',
        $constraint$CHECK (marital_status IS NULL OR marital_status IN ('solteiro', 'casado', 'divorciado', 'viuvo', 'separado', 'uniao_estavel'))$constraint$),
      ('public.plan_requests'::regclass, 'plan_requests_review_check',
        $constraint$CHECK ((status = 'pending' AND reviewed_at IS NULL) OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL))$constraint$),
      ('public.payments'::regclass, 'payments_amount_cents_check',
        $constraint$CHECK (amount_cents > 0)$constraint$),
      ('public.payments'::regclass, 'payments_period_check',
        $constraint$CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')$constraint$),
      ('public.commission_entries'::regclass, 'commission_entries_users_differ_check',
        $constraint$CHECK (sponsor_id <> referred_user_id)$constraint$),
      ('public.commission_entries'::regclass, 'commission_entries_type_check',
        $constraint$CHECK (type IN ('direct', 'network'))$constraint$),
      ('public.commission_entries'::regclass, 'commission_entries_level_check',
        $constraint$CHECK (level BETWEEN 0 AND 4)$constraint$),
      ('public.commission_entries'::regclass, 'commission_entries_amount_cents_check',
        $constraint$CHECK (amount_cents > 0)$constraint$),
      ('public.commission_entries'::regclass, 'commission_entries_status_check',
        $constraint$CHECK (status IN ('available', 'paid', 'withdrawn'))$constraint$),
      ('public.cashback_payments'::regclass, 'cashback_payments_amount_cents_check',
        $constraint$CHECK (amount_cents > 0)$constraint$),
      ('public.cashback_payments'::regclass, 'cashback_payments_month_number_check',
        $constraint$CHECK (month_number BETWEEN 1 AND 12)$constraint$),
      ('public.withdrawal_requests'::regclass, 'withdrawal_requests_amount_cents_check',
        $constraint$CHECK (amount_cents > 0)$constraint$),
      ('public.withdrawal_requests'::regclass, 'withdrawal_requests_pix_key_type_check',
        $constraint$CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'evp'))$constraint$),
      ('public.withdrawal_requests'::regclass, 'withdrawal_requests_status_check',
        $constraint$CHECK (status IN ('pending', 'approved', 'rejected'))$constraint$),
      ('public.withdrawal_requests'::regclass, 'withdrawal_requests_review_check',
        $constraint$CHECK ((status = 'pending' AND reviewed_at IS NULL) OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL))$constraint$),
      ('public.admin_users'::regclass, 'admin_users_role_check',
        $constraint$CHECK (role IN ('master', 'financeiro', 'suporte'))$constraint$),
      ('public.admin_users'::regclass, 'admin_users_token_version_check',
        $constraint$CHECK (token_version >= 0)$constraint$),
      ('public.admin_users'::regclass, 'admin_users_password_hash_check',
        $constraint$CHECK (length(password_hash) >= 20)$constraint$)
    ) AS constraints_to_add(table_oid, constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = item.table_oid
        AND conname = item.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT %I %s',
        item.table_oid,
        item.constraint_name,
        item.definition
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_referral_code_format_check'
  ) THEN
    -- O backfill abaixo roda antes de a constraint ser validada.
    ALTER TABLE public.users
      ADD CONSTRAINT users_referral_code_format_check
      CHECK (
        referral_code IS NULL
        OR referral_code ~ '^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
      ) NOT VALID;
  END IF;
END
$migration$;

-- Backfill idempotente de códigos de indicação no mesmo formato usado pela
-- aplicação. Inclui NULL e códigos legados fora do padrão.
DO $migration$
DECLARE
  chars      CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  target     RECORD;
  candidate  TEXT;
  attempt    INTEGER;
  char_index INTEGER;
BEGIN
  FOR target IN
    SELECT id
    FROM public.users
    WHERE referral_code IS NULL
       OR referral_code !~ '^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
    ORDER BY id
  LOOP
    candidate := NULL;

    FOR attempt IN 1..50 LOOP
      candidate := 'AP-';
      FOR char_index IN 1..8 LOOP
        candidate := candidate || substr(
          chars,
          floor(random() * length(chars))::INTEGER + 1,
          1
        );
      END LOOP;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.users
        WHERE referral_code = candidate
      );

      candidate := NULL;
    END LOOP;

    IF candidate IS NULL THEN
      RAISE EXCEPTION 'Não foi possível gerar referral_code para users.id=%', target.id;
    END IF;

    UPDATE public.users
    SET referral_code = candidate
    WHERE id = target.id;
  END LOOP;
END
$migration$;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_referral_code_format_check;

-- Falha com diagnóstico claro em vez de escolher silenciosamente qual dado
-- legado financeiro/de identidade deve prevalecer.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    GROUP BY lower(btrim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'users contém e-mails normalizados duplicados; resolva-os antes da migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_users
    GROUP BY lower(btrim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'admin_users contém e-mails normalizados duplicados; resolva-os antes da migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.plan_requests
    WHERE status = 'pending'
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'plan_requests contém múltiplas solicitações pendentes para o mesmo usuário';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.commission_entries
    GROUP BY sponsor_id, referred_user_id, period, level
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'commission_entries contém chaves de negócio duplicadas; reconcilie antes da migration';
  END IF;
END
$migration$;
