-- Migration: Add KYC fields to plan_requests
-- Run this in your Supabase SQL Editor

ALTER TABLE plan_requests
  ADD COLUMN IF NOT EXISTS full_name       TEXT,
  ADD COLUMN IF NOT EXISTS cpf             TEXT,
  ADD COLUMN IF NOT EXISTS rg              TEXT,
  ADD COLUMN IF NOT EXISTS rg_issue_date   TEXT,
  ADD COLUMN IF NOT EXISTS rg_issuer       TEXT,
  ADD COLUMN IF NOT EXISTS birth_date      TEXT,
  ADD COLUMN IF NOT EXISTS birth_state     TEXT,
  ADD COLUMN IF NOT EXISTS birth_city      TEXT,
  ADD COLUMN IF NOT EXISTS father_name     TEXT,
  ADD COLUMN IF NOT EXISTS mother_name     TEXT,
  ADD COLUMN IF NOT EXISTS patrimony_cents BIGINT,
  ADD COLUMN IF NOT EXISTS email           TEXT;
