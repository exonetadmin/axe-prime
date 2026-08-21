
-- Rate limit compartilhado entre instâncias. key_hash é um HMAC-SHA-256
-- hexadecimal do identificador normalizado; IP/e-mail nunca são persistidos
-- em claro nesta tabela.
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key_hash           CHAR(64) PRIMARY KEY,
  action             TEXT NOT NULL,
  attempts           INTEGER NOT NULL DEFAULT 0,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until      TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_rate_limits_key_hash_check CHECK (
    key_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT auth_rate_limits_action_check CHECK (
    length(btrim(action)) BETWEEN 1 AND 64
  ),
  CONSTRAINT auth_rate_limits_attempts_check CHECK (attempts >= 0),
  CONSTRAINT auth_rate_limits_blocked_until_check CHECK (
    blocked_until IS NULL OR blocked_until >= window_started_at
  ),
  CONSTRAINT auth_rate_limits_updated_at_check CHECK (
    updated_at >= window_started_at
  )
);

-- Completa instalações parciais da tabela sem apagar buckets existentes.
ALTER TABLE IF EXISTS public.auth_rate_limits
  ADD COLUMN IF NOT EXISTS key_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER,
  ADD COLUMN IF NOT EXISTS window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.auth_rate_limits
SET
  key_hash = CASE
    WHEN lower(btrim(key_hash)) ~ '^[0-9a-f]{64}$'
      THEN lower(btrim(key_hash))
    ELSE encode(gen_random_bytes(32), 'hex')
  END,
  action = CASE
    WHEN length(btrim(action)) BETWEEN 1 AND 64 THEN btrim(action)
    ELSE 'legacy'
  END,
  attempts = GREATEST(COALESCE(attempts, 0), 0),
  window_started_at = COALESCE(window_started_at, updated_at, NOW()),
  blocked_until = CASE
    WHEN blocked_until >= COALESCE(window_started_at, updated_at, NOW())
      THEN blocked_until
    ELSE NULL
  END,
  updated_at = GREATEST(
    COALESCE(updated_at, window_started_at, NOW()),
    COALESCE(window_started_at, updated_at, NOW())
  )
WHERE key_hash IS NULL
   OR lower(btrim(key_hash)) !~ '^[0-9a-f]{64}$'
   OR action IS NULL
   OR length(btrim(action)) NOT BETWEEN 1 AND 64
   OR attempts IS NULL
   OR attempts < 0
   OR window_started_at IS NULL
   OR (blocked_until IS NOT NULL AND blocked_until < window_started_at)
   OR updated_at IS NULL
   OR updated_at < window_started_at;

ALTER TABLE IF EXISTS public.auth_rate_limits
  ALTER COLUMN key_hash SET NOT NULL,
  ALTER COLUMN action SET NOT NULL,
  ALTER COLUMN attempts SET DEFAULT 0,
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN window_started_at SET DEFAULT NOW(),
  ALTER COLUMN window_started_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS index_definition
    JOIN pg_attribute AS indexed_column
      ON indexed_column.attrelid = index_definition.indrelid
     AND indexed_column.attnum = index_definition.indkey[0]
    WHERE index_definition.indrelid = 'public.auth_rate_limits'::regclass
      AND index_definition.indisunique
      AND index_definition.indpred IS NULL
      AND index_definition.indexprs IS NULL
      AND index_definition.indnkeyatts = 1
      AND indexed_column.attname = 'key_hash'
  ) THEN
    CREATE UNIQUE INDEX ux_auth_rate_limits_key_hash
      ON public.auth_rate_limits (key_hash);
  END IF;
END
$migration$;

DO $migration$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT *
    FROM (VALUES
      ('auth_rate_limits_key_hash_check',
        $constraint$CHECK (key_hash ~ '^[0-9a-f]{64}$')$constraint$),
      ('auth_rate_limits_action_check',
        $constraint$CHECK (length(btrim(action)) BETWEEN 1 AND 64)$constraint$),
      ('auth_rate_limits_attempts_check',
        $constraint$CHECK (attempts >= 0)$constraint$),
      ('auth_rate_limits_blocked_until_check',
        $constraint$CHECK (blocked_until IS NULL OR blocked_until >= window_started_at)$constraint$),
      ('auth_rate_limits_updated_at_check',
        $constraint$CHECK (updated_at >= window_started_at)$constraint$)
    ) AS constraints_to_add(constraint_name, definition)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.auth_rate_limits'::regclass
        AND conname = item.constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.auth_rate_limits ADD CONSTRAINT %I %s',
        item.constraint_name,
        item.definition
      );
    END IF;
  END LOOP;
END
$migration$;

-- Garante unicidade dos tokens emitidos pelo backend novo.
CREATE UNIQUE INDEX IF NOT EXISTS ux_password_reset_tokens_hash
  ON public.password_reset_tokens (token_hash);

-- O sistema legado chegou a expor tokens brutos em logs. Não os carregamos
-- para o modelo novo: toda recuperação em andamento deve ser solicitada outra
-- vez depois da migração.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS reset_token,
  DROP COLUMN IF EXISTS reset_token_expires;
