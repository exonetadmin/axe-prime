
CREATE TABLE IF NOT EXISTS public.admin_users (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  password_hash        TEXT,
  role                 TEXT NOT NULL DEFAULT 'suporte',
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  token_version        INTEGER NOT NULL DEFAULT 0,
  password_changed_at  TIMESTAMPTZ,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_users_role_check CHECK (
    role IN ('master', 'financeiro', 'suporte')
  ),
  CONSTRAINT admin_users_token_version_check CHECK (token_version >= 0),
  CONSTRAINT admin_users_password_hash_check CHECK (
    password_hash IS NULL OR length(password_hash) >= 20
  )
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_version INTEGER,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

UPDATE public.admin_users
SET token_version = 0
WHERE token_version IS NULL;

-- Converte senhas legadas em claro para bcrypt antes de apagar a coluna.
-- Hashes bcrypt já existentes são preservados sem dupla codificação.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND column_name = 'password'
  ) THEN
    -- Credenciais que já foram publicadas no repositório não podem continuar
    -- válidas, mesmo depois de transformadas em hash. Desativa essas contas e
    -- substitui a senha por material aleatório irrecuperável.
    EXECUTE $sql$
      UPDATE public.admin_users
      SET password_hash = crypt(
            encode(gen_random_bytes(48), 'hex'),
            gen_salt('bf', 12)
          ),
          active = FALSE,
          token_version = COALESCE(token_version, 0) + 1,
          password_changed_at = NOW()
      WHERE id IN ('adm-001', 'adm-002', 'adm-003')
         OR lower(btrim(email)) IN (
           'admin@axeprime.com',
           'financeiro@axeprime.com',
           'suporte@axeprime.com',
           'contatoaxeprime@gmail.com',
           'daniel01cordeiro@gmail.com'
         )
    $sql$;

    EXECUTE $sql$
      UPDATE public.admin_users
      SET password_hash = CASE
        WHEN password ~ '^\$2[aby]\$[0-9]{2}\$' THEN password
        ELSE crypt(password, gen_salt('bf', 12))
      END
      WHERE password_hash IS NULL
        AND password IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.admin_users WHERE password_hash IS NULL
  ) THEN
    RAISE EXCEPTION
      'admin_users contém registros sem password_hash; corrija-os antes de continuar';
  END IF;
END
$migration$;

ALTER TABLE public.admin_users
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN token_version SET DEFAULT 0,
  ALTER COLUMN token_version SET NOT NULL,
  DROP COLUMN IF EXISTS password;
