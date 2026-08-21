
-- Armazena os avatares diretamente no PostgreSQL. A aplicação serve estes
-- bytes somente por rota autenticada/cacheável; nenhum BYTEA é exposto em
-- consultas gerais de users.
CREATE TABLE IF NOT EXISTS public.user_avatars (
  user_id       TEXT PRIMARY KEY
                  REFERENCES public.users(id) ON DELETE CASCADE,
  content_type  TEXT NOT NULL,
  data          BYTEA NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sha256        VARCHAR(64) NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_avatars_content_type_check CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
  ),
  CONSTRAINT user_avatars_size_bytes_check CHECK (
    size_bytes BETWEEN 1 AND 5242880
    AND size_bytes = octet_length(data)
  ),
  CONSTRAINT user_avatars_sha256_check CHECK (
    sha256 ~ '^[0-9a-f]{64}$'
  )
);
