
CREATE TABLE IF NOT EXISTS public.plans (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  monthly_cents  INTEGER NOT NULL,
  CONSTRAINT plans_id_check CHECK (id IN ('start', 'prime', 'elite')),
  CONSTRAINT plans_monthly_cents_check CHECK (monthly_cents >= 0)
);
