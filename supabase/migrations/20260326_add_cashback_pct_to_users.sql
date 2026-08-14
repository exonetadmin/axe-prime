-- Add cashback_pct column to users table
-- This allows per-user cashback % override set by admin

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cashback_pct INTEGER DEFAULT 40;
