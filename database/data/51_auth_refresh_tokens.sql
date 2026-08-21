
CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL
                            REFERENCES public.auth_sessions(id) ON DELETE CASCADE,
  token_hash            VARCHAR(64) NOT NULL,
  issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  consumed_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  replaced_by_token_id  UUID REFERENCES public.auth_refresh_tokens(id)
                            ON DELETE SET NULL,
  CONSTRAINT auth_refresh_tokens_hash_format_check CHECK (
    token_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_refresh_tokens_expiry_check CHECK (expires_at > issued_at),
  CONSTRAINT auth_refresh_tokens_consumed_check CHECK (
    consumed_at IS NULL OR consumed_at >= issued_at
  ),
  CONSTRAINT auth_refresh_tokens_revoked_check CHECK (
    revoked_at IS NULL OR revoked_at >= issued_at
  )
);
