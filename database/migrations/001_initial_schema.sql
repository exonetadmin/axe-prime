-- AXE PRIME
-- PostgreSQL schema consolidado e autogerenciado
--
-- Esta migration pode ser executada tanto em um banco vazio quanto sobre o
-- schema PostgreSQL legado da aplicação. Ela evita
-- credenciais padrão e nunca persiste tokens de autenticação em texto puro.
-- A atomicidade é fornecida por scripts/migrate-postgres.mjs; não adicione
-- BEGIN/COMMIT a arquivos individuais de migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Recursos descontinuados do antigo copiloto não pertencem ao produto atual.
DROP TABLE IF EXISTS public.copiloto_persona;
DROP TABLE IF EXISTS public.knowledge_entries;

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

-- Armazena os avatares diretamente no PostgreSQL. A aplicação serve estes
-- bytes somente por rota autenticada/cacheável; nenhum BYTEA é exposto em
-- consultas gerais de users.
CREATE TABLE IF NOT EXISTS public.user_avatars (
  user_id       TEXT PRIMARY KEY
                  REFERENCES public.users(id) ON DELETE CASCADE,
  content_type  TEXT NOT NULL,
  data          BYTEA NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sha256        VARCHAR(64) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_avatars_content_type_check CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  ),
  CONSTRAINT user_avatars_size_bytes_check CHECK (
    size_bytes BETWEEN 1 AND 5242880
    AND size_bytes = octet_length(data)
  ),
  CONSTRAINT user_avatars_sha256_check CHECK (
    sha256 ~ '^[0-9a-f]{64}$'
  )
);

CREATE TABLE IF NOT EXISTS public.plans (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  monthly_cents  INTEGER NOT NULL,
  CONSTRAINT plans_id_check CHECK (id IN ('start', 'prime', 'elite')),
  CONSTRAINT plans_monthly_cents_check CHECK (monthly_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- Solicitações de plano e dados KYC
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_requests (
  id                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id                   TEXT NOT NULL
                              REFERENCES public.users(id) ON DELETE RESTRICT,
  type                      TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pending',
  requested_plan            TEXT NOT NULL,
  monthly_investment_cents  INTEGER NOT NULL,
  full_name                 TEXT,
  cpf                       TEXT,
  rg                        TEXT,
  rg_issue_date             TEXT,
  rg_issuer                 TEXT,
  birth_date                TEXT,
  birth_state               TEXT,
  birth_city                TEXT,
  father_name               TEXT,
  mother_name               TEXT,
  profession                TEXT,
  monthly_income_cents      INTEGER,
  patrimony_cents           BIGINT,
  address_cep               TEXT,
  address_street            TEXT,
  address_number            TEXT,
  address_complement        TEXT,
  address_city              TEXT,
  address_state             TEXT,
  phone                     TEXT,
  email                     TEXT,
  marital_status            TEXT,
  doc_type                  TEXT,
  doc_number                TEXT,
  reviewed_by               TEXT,
  reviewed_at               TIMESTAMPTZ,
  review_note               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plan_requests_type_check CHECK (
    type IN ('onboarding', 'plan_change')
  ),
  CONSTRAINT plan_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT plan_requests_requested_plan_check CHECK (
    requested_plan IN ('start', 'prime', 'elite')
  ),
  CONSTRAINT plan_requests_monthly_investment_check CHECK (
    monthly_investment_cents >= 0
  ),
  CONSTRAINT plan_requests_monthly_income_check CHECK (
    monthly_income_cents IS NULL OR monthly_income_cents >= 0
  ),
  CONSTRAINT plan_requests_patrimony_check CHECK (
    patrimony_cents IS NULL OR patrimony_cents >= 0
  ),
  CONSTRAINT plan_requests_marital_status_check CHECK (
    marital_status IS NULL OR marital_status IN (
      'solteiro',
      'casado',
      'divorciado',
      'viuvo',
      'separado',
      'uniao_estavel'
    )
  ),
  CONSTRAINT plan_requests_review_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)
  )
);

ALTER TABLE public.plan_requests
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS rg_issue_date TEXT,
  ADD COLUMN IF NOT EXISTS rg_issuer TEXT,
  ADD COLUMN IF NOT EXISTS birth_date TEXT,
  ADD COLUMN IF NOT EXISTS birth_state TEXT,
  ADD COLUMN IF NOT EXISTS birth_city TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS mother_name TEXT,
  ADD COLUMN IF NOT EXISTS patrimony_cents BIGINT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS marital_status TEXT;

-- ---------------------------------------------------------------------------
-- Financeiro, cashback, comissões e saques
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL
                  REFERENCES public.users(id) ON DELETE RESTRICT,
  amount_cents  INTEGER NOT NULL,
  period        TEXT NOT NULL,
  paid_at       TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT payments_period_check CHECK (
    period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  )
);

CREATE TABLE IF NOT EXISTS public.commission_entries (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  sponsor_id        TEXT NOT NULL
                      REFERENCES public.users(id) ON DELETE RESTRICT,
  referred_user_id  TEXT NOT NULL
                      REFERENCES public.users(id) ON DELETE RESTRICT,
  type              TEXT NOT NULL,
  level             INTEGER NOT NULL DEFAULT 0,
  amount_cents      INTEGER NOT NULL,
  period            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'available',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commission_entries_users_differ_check CHECK (
    sponsor_id <> referred_user_id
  ),
  CONSTRAINT commission_entries_type_check CHECK (
    type IN ('direct', 'network')
  ),
  CONSTRAINT commission_entries_level_check CHECK (level BETWEEN 0 AND 4),
  CONSTRAINT commission_entries_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT commission_entries_status_check CHECK (
    status IN ('available', 'paid', 'withdrawn')
  )
);

CREATE TABLE IF NOT EXISTS public.cashback_payments (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL
                  REFERENCES public.users(id) ON DELETE RESTRICT,
  month_number  INTEGER NOT NULL,
  amount_cents  INTEGER NOT NULL,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cashback_payments_month_number_check CHECK (
    month_number BETWEEN 1 AND 12
  ),
  CONSTRAINT cashback_payments_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT cashback_payments_user_month_key UNIQUE (user_id, month_number)
);

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL
                  REFERENCES public.users(id) ON DELETE RESTRICT,
  amount_cents  INTEGER NOT NULL,
  pix_key       TEXT NOT NULL,
  pix_key_type  TEXT NOT NULL DEFAULT 'cpf',
  status        TEXT NOT NULL DEFAULT 'pending',
  reviewed_by   TEXT,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdrawal_requests_amount_cents_check CHECK (amount_cents > 0),
  CONSTRAINT withdrawal_requests_pix_key_type_check CHECK (
    pix_key_type IN ('cpf', 'cnpj', 'email', 'phone', 'evp')
  ),
  CONSTRAINT withdrawal_requests_status_check CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT withdrawal_requests_review_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL)
  )
);

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS pix_key_type TEXT,
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;

UPDATE public.withdrawal_requests
SET
  pix_key_type = COALESCE(pix_key_type, 'cpf'),
  requested_at = COALESCE(requested_at, created_at)
WHERE pix_key_type IS NULL OR requested_at IS NULL;

ALTER TABLE public.withdrawal_requests
  ALTER COLUMN pix_key_type SET DEFAULT 'cpf',
  ALTER COLUMN pix_key_type SET NOT NULL,
  ALTER COLUMN requested_at SET DEFAULT NOW(),
  ALTER COLUMN requested_at SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Configuração da plataforma e administradores
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.platform_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  password_hash        TEXT,
  role                 TEXT NOT NULL DEFAULT 'suporte',
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  token_version        INTEGER NOT NULL DEFAULT 0,
  password_changed_at  TIMESTAMPTZ,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_users_role_check CHECK (
    role IN ('master', 'financeiro', 'suporte')
  ),
  CONSTRAINT admin_users_token_version_check CHECK (token_version >= 0),
  CONSTRAINT admin_users_password_hash_check CHECK (
    password_hash IS NULL OR length(password_hash) >= 20
  )
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_version INTEGER,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE public.admin_users
SET token_version = 0
WHERE token_version IS NULL;

-- Converte senhas legadas em claro para bcrypt antes de apagar a coluna.
-- Hashes bcrypt já existentes são preservados sem dupla codificação.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'password'
  ) THEN
    -- Credenciais que já foram publicadas no repositório não podem continuar
    -- válidas, mesmo depois de transformadas em hash. Desativa essas contas e
    -- substitui a senha por material aleatório irrecuperável.
    EXECUTE $sql$
      UPDATE public.admin_users
      SET password_hash = crypt(
            encode(gen_random_bytes(48), 'hex'),
            gen_salt('bf', 12)
          ),
          active = FALSE,
          token_version = COALESCE(token_version, 0) + 1,
          password_changed_at = NOW()
      WHERE id IN ('adm-001', 'adm-002', 'adm-003')
         OR lower(btrim(email)) IN (
           'admin@axeprime.com',
           'financeiro@axeprime.com',
           'suporte@axeprime.com',
           'contatoaxeprime@gmail.com',
           'daniel01cordeiro@gmail.com'
         )
    $sql$;

    EXECUTE $sql$
      UPDATE public.admin_users
      SET password_hash = CASE
        WHEN password ~ '^\$2[aby]\$[0-9]{2}\$' THEN password
        ELSE crypt(password, gen_salt('bf', 12))
      END
      WHERE password_hash IS NULL
        AND password IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_users WHERE password_hash IS NULL
  ) THEN
    RAISE EXCEPTION
      'admin_users contém registros sem password_hash; corrija-os antes de continuar';
  END IF;
END
$migration$;

ALTER TABLE public.admin_users
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN token_version SET DEFAULT 0,
  ALTER COLUMN token_version SET NOT NULL,
  DROP COLUMN IF EXISTS password;

-- CREATE TABLE IF NOT EXISTS não atualiza defaults de tabelas já criadas pelo
-- schema legado. Uniformiza os identificadores gerados pelo PostgreSQL para que
-- inserts backend que omitem id funcionem igualmente em bancos novos e migrados.
ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.plan_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.payments
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.commission_entries
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.cashback_payments
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.admin_users
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- Converge as FKs do schema legado. Usuários são desativados logicamente; um
-- hard-delete não pode apagar silenciosamente histórico financeiro/KYC.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_sponsor_id_fkey,
  ADD CONSTRAINT users_sponsor_id_fkey
    FOREIGN KEY (sponsor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.plan_requests
  DROP CONSTRAINT IF EXISTS plan_requests_user_id_fkey,
  ADD CONSTRAINT plan_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
  ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.commission_entries
  DROP CONSTRAINT IF EXISTS commission_entries_sponsor_id_fkey,
  DROP CONSTRAINT IF EXISTS commission_entries_referred_user_id_fkey,
  ADD CONSTRAINT commission_entries_sponsor_id_fkey
    FOREIGN KEY (sponsor_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT commission_entries_referred_user_id_fkey
    FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.cashback_payments
  DROP CONSTRAINT IF EXISTS cashback_payments_user_id_fkey,
  ADD CONSTRAINT cashback_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey,
  ADD CONSTRAINT withdrawal_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Sessões Bearer e tokens opacos rotativos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  admin_user_id    TEXT REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_version    INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  revoked_at       TIMESTAMPTZ,
  revoke_reason    TEXT,
  user_agent_hash  TEXT,
  ip_address       INET,
  CONSTRAINT auth_sessions_single_subject_check CHECK (
    (user_id IS NOT NULL)::INTEGER + (admin_user_id IS NOT NULL)::INTEGER = 1
  ),
  CONSTRAINT auth_sessions_token_version_check CHECK (token_version >= 0),
  CONSTRAINT auth_sessions_user_agent_hash_check CHECK (
    user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT auth_sessions_revocation_check CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);

CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL
                            REFERENCES public.auth_sessions(id) ON DELETE CASCADE,
  token_hash            VARCHAR(64) NOT NULL,
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  replaced_by_token_id  UUID REFERENCES public.auth_refresh_tokens(id)
                            ON DELETE SET NULL,
  CONSTRAINT auth_refresh_tokens_hash_format_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_refresh_tokens_expiry_check CHECK (expires_at > issued_at),
  CONSTRAINT auth_refresh_tokens_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= issued_at
  ),
  CONSTRAINT auth_refresh_tokens_revoked_check CHECK (
    revoked_at IS NULL OR revoked_at >= issued_at
  )
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL
                 REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  CONSTRAINT password_reset_tokens_hash_format_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT password_reset_tokens_expiry_check CHECK (
    expires_at > created_at
  ),
  CONSTRAINT password_reset_tokens_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);

-- Rate limit compartilhado entre instâncias. key_hash é um HMAC-SHA-256
-- hexadecimal do identificador normalizado; IP/e-mail nunca são persistidos
-- em claro nesta tabela.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key_hash           CHAR(64) PRIMARY KEY,
  action             TEXT NOT NULL,
  attempts           INTEGER NOT NULL DEFAULT 0,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until      TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_rate_limits_key_hash_check CHECK (
    key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_rate_limits_action_check CHECK (
    length(btrim(action)) BETWEEN 1 AND 64
  ),
  CONSTRAINT auth_rate_limits_attempts_check CHECK (attempts >= 0),
  CONSTRAINT auth_rate_limits_blocked_until_check CHECK (
    blocked_until IS NULL OR blocked_until >= window_started_at
  ),
  CONSTRAINT auth_rate_limits_updated_at_check CHECK (
    updated_at >= window_started_at
  )
);

-- Completa instalações parciais da tabela sem apagar buckets existentes.
ALTER TABLE IF EXISTS public.auth_rate_limits
  ADD COLUMN IF NOT EXISTS key_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER,
  ADD COLUMN IF NOT EXISTS window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.auth_rate_limits
SET
  key_hash = CASE
    WHEN lower(btrim(key_hash)) ~ '^[0-9a-f]{64}$'
      THEN lower(btrim(key_hash))
    ELSE encode(gen_random_bytes(32), 'hex')
  END,
  action = CASE
    WHEN length(btrim(action)) BETWEEN 1 AND 64 THEN btrim(action)
    ELSE 'legacy'
  END,
  attempts = GREATEST(COALESCE(attempts, 0), 0),
  window_started_at = COALESCE(window_started_at, updated_at, NOW()),
  blocked_until = CASE
    WHEN blocked_until >= COALESCE(window_started_at, updated_at, NOW())
      THEN blocked_until
    ELSE NULL
  END,
  updated_at = GREATEST(
    COALESCE(updated_at, window_started_at, NOW()),
    COALESCE(window_started_at, updated_at, NOW())
  )
WHERE key_hash IS NULL
   OR lower(btrim(key_hash)) !~ '^[0-9a-f]{64}$'
   OR action IS NULL
   OR length(btrim(action)) NOT BETWEEN 1 AND 64
   OR attempts IS NULL
   OR attempts < 0
   OR window_started_at IS NULL
   OR (blocked_until IS NOT NULL AND blocked_until < window_started_at)
   OR updated_at IS NULL
   OR updated_at < window_started_at;

ALTER TABLE IF EXISTS public.auth_rate_limits
  ALTER COLUMN key_hash SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN attempts SET DEFAULT 0,
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN window_started_at SET DEFAULT NOW(),
  ALTER COLUMN window_started_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS index_definition
    JOIN pg_attribute AS indexed_column
      ON indexed_column.attrelid = index_definition.indrelid
     AND indexed_column.attnum = index_definition.indkey[0]
    WHERE index_definition.indrelid = 'public.auth_rate_limits'::regclass
      AND index_definition.indisunique
      AND index_definition.indpred IS NULL
      AND index_definition.indexprs IS NULL
      AND index_definition.indnkeyatts = 1
      AND indexed_column.attname = 'key_hash'
  ) THEN
    CREATE UNIQUE INDEX ux_auth_rate_limits_key_hash
      ON public.auth_rate_limits (key_hash);
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
      ('auth_rate_limits_key_hash_check',
        $constraint$CHECK (key_hash ~ '^[0-9a-f]{64}$')$constraint$),
      ('auth_rate_limits_action_check',
        $constraint$CHECK (length(btrim(action)) BETWEEN 1 AND 64)$constraint$),
      ('auth_rate_limits_attempts_check',
        $constraint$CHECK (attempts >= 0)$constraint$),
      ('auth_rate_limits_blocked_until_check',
        $constraint$CHECK (blocked_until IS NULL OR blocked_until >= window_started_at)$constraint$),
      ('auth_rate_limits_updated_at_check',
        $constraint$CHECK (updated_at >= window_started_at)$constraint$)
    ) AS constraints_to_add(constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.auth_rate_limits'::regclass
        AND conname = item.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.auth_rate_limits ADD CONSTRAINT %I %s',
        item.constraint_name,
        item.definition
      );
    END IF;
  END LOOP;
END
$migration$;

-- Garante unicidade dos tokens emitidos pelo backend novo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_password_reset_tokens_hash
  ON public.password_reset_tokens (token_hash);

-- O sistema legado chegou a expor tokens brutos em logs. Não os carregamos
-- para o modelo novo: toda recuperação em andamento deve ser solicitada outra
-- vez depois da migração.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS reset_token,
  DROP COLUMN IF EXISTS reset_token_expires;

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

-- ---------------------------------------------------------------------------
-- Índices e garantias de unicidade
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_normalized
  ON public.users (lower(btrim(email)));
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_users_sponsor_id
  ON public.users (sponsor_id);
CREATE INDEX IF NOT EXISTS ix_users_created_at
  ON public.users (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_users_plan_interest
  ON public.users (plan_interest);
CREATE INDEX IF NOT EXISTS ix_users_active_billing
  ON public.users (adhesion_paid, monthly_status)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS ix_plan_requests_user_status_created
  ON public.plan_requests (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_plan_requests_status_created
  ON public.plan_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_plan_requests_one_pending_per_user
  ON public.plan_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ix_payments_user_period
  ON public.payments (user_id, period DESC);
CREATE INDEX IF NOT EXISTS ix_payments_period
  ON public.payments (period);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commission_entries_business_key
  ON public.commission_entries (
    sponsor_id,
    referred_user_id,
    period,
    level
  );
CREATE INDEX IF NOT EXISTS ix_commission_entries_sponsor_status_created
  ON public.commission_entries (sponsor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_commission_entries_referred_period
  ON public.commission_entries (referred_user_id, period);
CREATE INDEX IF NOT EXISTS ix_commission_entries_period_status
  ON public.commission_entries (period, status);

CREATE INDEX IF NOT EXISTS ix_cashback_payments_user_paid_at
  ON public.cashback_payments (user_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS ix_withdrawal_requests_user_status_created
  ON public.withdrawal_requests (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_withdrawal_requests_status_created
  ON public.withdrawal_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_users_email_normalized
  ON public.admin_users (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS ix_admin_users_active_created
  ON public.admin_users (active, created_at);

CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_active
  ON public.auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_admin_active
  ON public.auth_sessions (admin_user_id, expires_at)
  WHERE revoked_at IS NULL AND admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_expiry
  ON public.auth_sessions (expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_sessions_revoked_retention
  ON public.auth_sessions (revoked_at)
  WHERE revoked_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_refresh_tokens_hash
  ON public.auth_refresh_tokens (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_refresh_tokens_one_active_per_session
  ON public.auth_refresh_tokens (session_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_session
  ON public.auth_refresh_tokens (session_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_expiry
  ON public.auth_refresh_tokens (expires_at)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_consumed_retention
  ON public.auth_refresh_tokens (consumed_at)
  WHERE consumed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_revoked_retention
  ON public.auth_refresh_tokens (revoked_at)
  WHERE revoked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_refresh_tokens_replaced_by
  ON public.auth_refresh_tokens (replaced_by_token_id)
  WHERE replaced_by_token_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user
  ON public.password_reset_tokens (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_password_reset_tokens_one_active_per_user
  ON public.password_reset_tokens (user_id)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expiry
  ON public.password_reset_tokens (expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_consumed_retention
  ON public.password_reset_tokens (consumed_at)
  WHERE consumed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_blocked_until
  ON public.auth_rate_limits (blocked_until)
  WHERE blocked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_auth_rate_limits_updated_at
  ON public.auth_rate_limits (updated_at);

-- ---------------------------------------------------------------------------
-- Seeds não sensíveis
-- ---------------------------------------------------------------------------

INSERT INTO public.plans (id, name, monthly_cents) VALUES
  ('start', 'Start', 9900),
  ('prime', 'Prime', 19900),
  ('elite', 'Elite', 29900)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_config (key, value) VALUES
  ('cashback_pct', '40'),
  ('pix_key', ''),
  ('pix_holder', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_config (key, value) VALUES
  ('commission_direct_pct', '10'),
  ('commission_level1_pct', '2'),
  ('commission_level2_pct', '1'),
  ('commission_level3_pct', '0.5'),
  ('commission_level4_pct', '0'),
  ('cashback_standard_pct', '40'),
  ('cashback_premium_pct', '50'),
  ('cashback_premium_threshold_cents', '1000000'),
  ('cashback_duration_months', '12'),
  ('cashback_credit_day', '16')
ON CONFLICT (key) DO NOTHING;

-- O domínio paga N1 direto e quatro uplines (N2 a N5). A chave legada abaixo
-- representava uma sexta faixa que nunca era gerada pelo motor de comissões.
DELETE FROM public.platform_config
WHERE key = 'commission_level5_pct';

-- O domínio e cashback_payments numeram o benefício de 1 a 12. Corrige uma
-- configuração legada fora dessa faixa sem afetar valores válidos.
UPDATE public.platform_config
SET value = '12', updated_at = NOW()
WHERE key = 'cashback_duration_months'
  AND CASE
        WHEN value ~ '^[0-9]+$' THEN value::NUMERIC NOT BETWEEN 1 AND 12
        ELSE TRUE
      END;

-- Administradores devem ser provisionados explicitamente pela aplicação ou
-- por um comando operacional que receba a senha fora do SQL. Não há senha
-- padrão nesta migration.

COMMENT ON COLUMN public.users.career IS
  'Carreira manual definida pelo admin; NULL mantém o cálculo dinâmico.';
COMMENT ON COLUMN public.users.token_version IS
  'Incrementado para invalidar todos os access tokens emitidos anteriormente.';
COMMENT ON COLUMN public.auth_refresh_tokens.token_hash IS
  'HMAC-SHA-256 hexadecimal do refresh token opaco; tokens legados podem usar SHA-256. O segredo bruto nunca é persistido.';
COMMENT ON TABLE public.auth_sessions IS
  'Sessões revogáveis referenciadas pelo claim sid dos access tokens Bearer.';
