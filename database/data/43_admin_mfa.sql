-- ---------------------------------------------------------------------------
-- MFA (TOTP) para administradores
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;

-- Tabela para desafios de login MFA em duas etapas.
CREATE TABLE IF NOT EXISTS public.admin_mfa_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   TEXT NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  token_version   INTEGER NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_mfa_challenges_token_version_check CHECK (token_version >= 0),
  CONSTRAINT admin_mfa_challenges_failed_attempts_check CHECK (
    failed_attempts >= 0
    AND failed_attempts <= 10
  ),
  CONSTRAINT admin_mfa_challenges_expiry_check CHECK (expires_at > created_at)
);

-- Mantém migrações idempotentes para banco legado: converte a coluna
-- mfa_secret para NULL em admins sem MFA ativo (padrão operacional).
UPDATE public.admin_users
   SET mfa_secret_encrypted = NULL
 WHERE mfa_enabled = FALSE;

-- Garante consistência do estado declarativo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'admin_users_mfa_state_check'
      AND t.relname = 'admin_users'
      AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_mfa_state_check
      CHECK (NOT mfa_enabled OR mfa_secret_encrypted IS NOT NULL);
  END IF;
END $$;
