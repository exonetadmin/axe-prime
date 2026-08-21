
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
