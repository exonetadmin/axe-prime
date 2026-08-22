-- Append-only security and financial audit trail. Runtime privileges are
-- narrowed by scripts/migrate-postgres.mjs after the schema is installed.
CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  category      TEXT NOT NULL,
  action        TEXT NOT NULL,
  outcome       TEXT NOT NULL,
  actor_type    TEXT NOT NULL,
  actor_id      TEXT,
  subject_type  TEXT,
  subject_id    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::JSONB,
  CONSTRAINT security_audit_events_category_check CHECK (
    category IN ('authentication', 'authorization', 'account', 'financial', 'configuration')
  ),
  CONSTRAINT security_audit_events_outcome_check CHECK (
    outcome IN ('success', 'failure', 'denied')
  ),
  CONSTRAINT security_audit_events_actor_type_check CHECK (
    actor_type IN ('user', 'admin', 'system', 'anonymous')
  ),
  CONSTRAINT security_audit_events_action_check CHECK (
    action ~ '^[a-z0-9:_-]{1,80}$'
  ),
  CONSTRAINT security_audit_events_metadata_size_check CHECK (
    pg_column_size(metadata) <= 8192
  )
);

CREATE INDEX IF NOT EXISTS idx_security_audit_events_occurred_at
  ON public.security_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_actor
  ON public.security_audit_events (actor_type, actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_events_subject
  ON public.security_audit_events (subject_type, subject_id, occurred_at DESC);

COMMENT ON TABLE public.security_audit_events IS
  'Trilha append-only de eventos de segurança e operações financeiras; nunca armazenar segredos ou PII em metadata.';
