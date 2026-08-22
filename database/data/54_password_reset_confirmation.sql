ALTER TABLE IF EXISTS public.password_reset_tokens
  ADD COLUMN IF NOT EXISTS email_confirmation_code_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_confirmation_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_confirmation_attempts INTEGER;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.password_reset_tokens'::regclass
      AND conname = 'password_reset_tokens_email_confirmation_code_hash_check'
  ) THEN
    ALTER TABLE public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_email_confirmation_code_hash_check
        CHECK (email_confirmation_code_hash ~ '^[0-9a-f]{64}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.password_reset_tokens'::regclass
      AND conname = 'password_reset_tokens_email_confirmation_code_expires_check'
  ) THEN
    ALTER TABLE public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_email_confirmation_code_expires_check
        CHECK (
          email_confirmation_code_expires_at IS NULL OR
          email_confirmation_code_expires_at <= expires_at
        );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.password_reset_tokens'::regclass
      AND conname = 'password_reset_tokens_email_confirmation_attempts_check'
  ) THEN
    ALTER TABLE public.password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_email_confirmation_attempts_check
        CHECK (email_confirmation_attempts IS NULL OR email_confirmation_attempts >= 0);
  END IF;
END
$migration$;

UPDATE public.password_reset_tokens
SET
  email_confirmation_code_hash = COALESCE(
    email_confirmation_code_hash,
    encode(gen_random_bytes(32), 'hex')
  ),
  email_confirmation_code_expires_at = COALESCE(
    email_confirmation_code_expires_at,
    created_at - INTERVAL '1 second'
  ),
  email_confirmation_attempts = GREATEST(COALESCE(email_confirmation_attempts, 0), 0);

ALTER TABLE IF EXISTS public.password_reset_tokens
  ALTER COLUMN email_confirmation_code_hash SET NOT NULL,
  ALTER COLUMN email_confirmation_code_expires_at SET NOT NULL,
  ALTER COLUMN email_confirmation_attempts SET DEFAULT 0,
  ALTER COLUMN email_confirmation_attempts SET NOT NULL;

