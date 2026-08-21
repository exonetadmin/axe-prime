
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL
                 REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  CONSTRAINT password_reset_tokens_hash_format_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT password_reset_tokens_expiry_check CHECK (
    expires_at > created_at
  ),
  CONSTRAINT password_reset_tokens_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);
