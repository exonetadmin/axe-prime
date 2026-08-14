-- Add marital_status column to plan_requests
ALTER TABLE plan_requests ADD COLUMN IF NOT EXISTS marital_status text;
