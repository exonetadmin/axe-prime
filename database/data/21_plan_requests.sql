
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
