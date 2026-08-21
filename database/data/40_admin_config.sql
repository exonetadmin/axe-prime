
-- ---------------------------------------------------------------------------
-- Configuração da plataforma e administradores
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
