-- AXE PRIME
-- PostgreSQL schema consolidado e autogerenciado
--
-- Esta migration pode ser executada tanto em um banco vazio quanto sobre o
-- schema PostgreSQL legado da aplicação. Ela evita
-- credenciais padrão e nunca persiste tokens de autenticação em texto puro.
-- A atomicidade é fornecida por scripts/migrate-postgres.mjs; não adicione
-- BEGIN/COMMIT a arquivos individuais de migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Recursos descontinuados do antigo copiloto não pertencem ao produto atual.
DROP TABLE IF EXISTS public.copiloto_persona;
DROP TABLE IF EXISTS public.knowledge_entries;
