-- ============================================================
-- AXE PRIME — Schema Supabase (Postgres)
-- Execute no SQL Editor do Supabase: https://app.supabase.com
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  name                    TEXT NOT NULL,
  email                   TEXT NOT NULL UNIQUE,
  password_hash           TEXT NOT NULL,
  plan_interest           TEXT CHECK (plan_interest IN ('start', 'prime', 'elite')),
  sponsor_id              TEXT REFERENCES users(id),
  referral_code           TEXT UNIQUE,
  avatar_url              TEXT,
  reset_token             TEXT,
  reset_token_expires     TIMESTAMPTZ,
  adhesion_at             TIMESTAMPTZ,
  plan_monthly_cents      INTEGER,
  adhesion_value_cents    INTEGER,
  kyc_submitted           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_referral_code   ON users (referral_code);
CREATE INDEX IF NOT EXISTS idx_users_sponsor_id      ON users (sponsor_id);

-- ── plans ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  monthly_cents   INTEGER NOT NULL
);
INSERT INTO plans (id, name, monthly_cents) VALUES
  ('start', 'Start', 9900),
  ('prime',  'Prime', 19900),
  ('elite', 'Elite',  29900)
ON CONFLICT (id) DO NOTHING;

-- ── plan_requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_requests (
  id                       TEXT PRIMARY KEY,
  user_id                  TEXT NOT NULL REFERENCES users(id),
  type                     TEXT NOT NULL CHECK (type IN ('onboarding', 'plan_change')),
  status                   TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_plan           TEXT NOT NULL CHECK (requested_plan IN ('start', 'prime', 'elite')),
  monthly_investment_cents INTEGER NOT NULL,
  doc_type                 TEXT,
  doc_number               TEXT,
  address_cep              TEXT,
  address_street           TEXT,
  address_number           TEXT,
  address_complement       TEXT,
  address_city             TEXT,
  address_state            TEXT,
  phone                    TEXT,
  profession               TEXT,
  monthly_income_cents     INTEGER,
  reviewed_by              TEXT,
  reviewed_at              TIMESTAMPTZ,
  review_note              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_requests_user_id ON plan_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_plan_requests_status  ON plan_requests (status);

-- ── payments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  amount_cents  INTEGER NOT NULL,
  period        TEXT NOT NULL,
  paid_at       TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_period  ON payments (period);

-- ── commission_entries ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commission_entries (
  id                TEXT PRIMARY KEY,
  sponsor_id        TEXT NOT NULL REFERENCES users(id),
  referred_user_id  TEXT NOT NULL REFERENCES users(id),
  type              TEXT NOT NULL,
  level             INTEGER NOT NULL DEFAULT 0,
  amount_cents      INTEGER NOT NULL,
  period            TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'available',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_commission_sponsor ON commission_entries (sponsor_id, status);

-- ── admin_config ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
INSERT INTO admin_config (key, value) VALUES
  ('cashback_pct', '40'),
  ('pix_key',      ''),
  ('pix_holder',   '')
ON CONFLICT (key) DO NOTHING;

-- ── platform_config ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_config (key, value) VALUES
  ('commission_direct_pct', '10'),
  ('commission_level1_pct', '2'),
  ('commission_level2_pct', '1'),
  ('commission_level3_pct', '0.5'),
  ('commission_level4_pct', '0'),
  ('commission_level5_pct', '0'),
  ('cashback_standard_pct', '40'),
  ('cashback_premium_pct', '50'),
  ('cashback_premium_threshold_cents', '1000000'),
  ('cashback_duration_months', '12'),
  ('cashback_credit_day', '16')
ON CONFLICT (key) DO NOTHING;

-- ── admin_users ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'suporte',
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO admin_users (id, name, email, password, role) VALUES
  ('adm-001', 'Wanderson Admin',  'admin@axeprime.com',      'senha123', 'master'),
  ('adm-002', 'Ana Financeiro',   'financeiro@axeprime.com', 'senha123', 'financeiro'),
  ('adm-003', 'Carlos Suporte',   'suporte@axeprime.com',    'senha123', 'suporte')
ON CONFLICT (id) DO NOTHING;

-- ── knowledge_entries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── copiloto_persona ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copiloto_persona (
  user_id      TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT 'Copiloto',
  style        TEXT NOT NULL DEFAULT 'empatico',
  tone         TEXT NOT NULL DEFAULT 'informal',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── withdrawal_requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  amount_cents  INTEGER NOT NULL,
  pix_key       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  reviewed_by   TEXT,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_requests (user_id);
