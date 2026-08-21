
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
