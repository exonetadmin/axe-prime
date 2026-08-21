
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
