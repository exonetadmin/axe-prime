-- Migration: add career column to users table
-- 2026-03-26
-- Allows admin to manually set a user's MLM career level,
-- which unlocks corresponding network commission levels.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS career text
    CHECK (career IN (
      'vendedor_elite',
      'supervisor',
      'gestor',
      'gerente_senior',
      'diretor_geral'
    ));

COMMENT ON COLUMN users.career IS
  'Carreira manual definida pelo admin. Quando preenchida, sobrescreve o cálculo automático de posição. NULL = calcula dinamicamente.';
