
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
