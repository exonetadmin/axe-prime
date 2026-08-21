
-- ---------------------------------------------------------------------------
-- Usuários e catálogo de planos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  phone                 TEXT,
  cpf                   TEXT,
  plan_interest         TEXT,
  sponsor_id            TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  referral_code         TEXT,
  avatar_url            TEXT,
  adhesion_at           TIMESTAMPTZ,
  plan_monthly_cents    INTEGER,
  adhesion_value_cents  INTEGER,
  cashback_pct          INTEGER NOT NULL DEFAULT 40,
  kyc_submitted         BOOLEAN NOT NULL DEFAULT FALSE,
  career                TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  adhesion_paid         BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_status        TEXT,
  token_version         INTEGER NOT NULL DEFAULT 0,
  password_changed_at   TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_plan_interest_check CHECK (
    plan_interest IS NULL OR plan_interest IN ('start', 'prime', 'elite')
  ),
  CONSTRAINT users_career_check CHECK (
    career IS NULL OR career IN (
      'vendedor_elite',
      'supervisor',
      'gestor',
      'gerente_senior',
      'diretor_geral'
    )
  ),
  CONSTRAINT users_monthly_status_check CHECK (
    monthly_status IS NULL OR monthly_status IN ('paid', 'overdue')
  ),
  CONSTRAINT users_cashback_pct_check CHECK (cashback_pct BETWEEN 0 AND 100),
  CONSTRAINT users_plan_monthly_cents_check CHECK (
    plan_monthly_cents IS NULL OR plan_monthly_cents >= 0
  ),
  CONSTRAINT users_adhesion_value_cents_check CHECK (
    adhesion_value_cents IS NULL OR adhesion_value_cents >= 0
  ),
  CONSTRAINT users_token_version_check CHECK (token_version >= 0),
  CONSTRAINT users_password_hash_check CHECK (length(password_hash) >= 20),
  CONSTRAINT users_referral_code_format_check CHECK (
    referral_code IS NULL
    OR referral_code ~ '^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$'
  ),
  CONSTRAINT users_sponsor_not_self_check CHECK (
    sponsor_id IS NULL OR sponsor_id <> id
  )
);

-- Compatibilidade com bancos que receberam somente parte das migrations
-- antigas. As colunas base já existem em 001_initial_schema.sql; este bloco
-- inclui todas as adições posteriores e as lacunas usadas pelos repositories.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS career TEXT,
  ADD COLUMN IF NOT EXISTS cashback_pct INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN,
  ADD COLUMN IF NOT EXISTS adhesion_paid BOOLEAN,
  ADD COLUMN IF NOT EXISTS monthly_status TEXT,
  ADD COLUMN IF NOT EXISTS token_version INTEGER,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE public.users
SET
  cashback_pct = COALESCE(cashback_pct, 40),
  is_active = COALESCE(is_active, TRUE),
  adhesion_paid = COALESCE(adhesion_paid, adhesion_at IS NOT NULL),
  token_version = COALESCE(token_version, 0)
WHERE cashback_pct IS NULL
   OR is_active IS NULL
   OR adhesion_paid IS NULL
   OR token_version IS NULL;

ALTER TABLE public.users
  ALTER COLUMN cashback_pct SET DEFAULT 40,
  ALTER COLUMN cashback_pct SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN adhesion_paid SET DEFAULT FALSE,
  ALTER COLUMN adhesion_paid SET NOT NULL,
  ALTER COLUMN token_version SET DEFAULT 0,
  ALTER COLUMN token_version SET NOT NULL;
