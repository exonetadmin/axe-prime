-- Adiciona coluna CPF à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;
