-- ============================================================
-- AXE PRIME — cashback_payments: rastreia pagamentos mensais de CB
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS cashback_payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  month_number  INTEGER NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  amount_cents  INTEGER NOT NULL,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by       TEXT,          -- admin que confirmou
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month_number)
);

CREATE INDEX IF NOT EXISTS idx_cashback_payments_user
  ON cashback_payments (user_id);
