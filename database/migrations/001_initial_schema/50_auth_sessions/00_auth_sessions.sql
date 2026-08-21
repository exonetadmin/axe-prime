
-- CREATE TABLE IF NOT EXISTS não atualiza defaults de tabelas já criadas pelo
-- schema legado. Uniformiza os identificadores gerados pelo PostgreSQL para que
-- inserts backend que omitem id funcionem igualmente em bancos novos e migrados.
ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.plan_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.payments
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.commission_entries
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.cashback_payments
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;
ALTER TABLE public.admin_users
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT;

-- Converge as FKs do schema legado. Usuários são desativados logicamente; um
-- hard-delete não pode apagar silenciosamente histórico financeiro/KYC.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_sponsor_id_fkey,
  ADD CONSTRAINT users_sponsor_id_fkey
    FOREIGN KEY (sponsor_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.plan_requests
  DROP CONSTRAINT IF EXISTS plan_requests_user_id_fkey,
  ADD CONSTRAINT plan_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
  ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.commission_entries
  DROP CONSTRAINT IF EXISTS commission_entries_sponsor_id_fkey,
  DROP CONSTRAINT IF EXISTS commission_entries_referred_user_id_fkey,
  ADD CONSTRAINT commission_entries_sponsor_id_fkey
    FOREIGN KEY (sponsor_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT commission_entries_referred_user_id_fkey
    FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.cashback_payments
  DROP CONSTRAINT IF EXISTS cashback_payments_user_id_fkey,
  ADD CONSTRAINT cashback_payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_user_id_fkey,
  ADD CONSTRAINT withdrawal_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Sessões Bearer e tokens opacos rotativos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  admin_user_id    TEXT REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token_version    INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  revoked_at       TIMESTAMPTZ,
  revoke_reason    TEXT,
  user_agent_hash  TEXT,
  ip_address       INET,
  CONSTRAINT auth_sessions_single_subject_check CHECK (
    (user_id IS NOT NULL)::INTEGER + (admin_user_id IS NOT NULL)::INTEGER = 1
  ),
  CONSTRAINT auth_sessions_token_version_check CHECK (token_version >= 0),
  CONSTRAINT auth_sessions_user_agent_hash_check CHECK (
    user_agent_hash IS NULL OR user_agent_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_sessions_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT auth_sessions_revocation_check CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  )
);
