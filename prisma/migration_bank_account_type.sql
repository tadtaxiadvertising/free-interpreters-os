-- Migration: Add bank_account_type column to user_profiles
-- Date: 2026-05-01
-- Description: Adds the account type field (Ahorro/Corriente) for RD banking
-- Safe: This is an additive migration — no data loss, no downtime required

-- Step 1: Add the column (nullable, no default — existing rows get NULL)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS bank_account_type TEXT;

-- Step 2: Add a comment for documentation
COMMENT ON COLUMN user_profiles.bank_account_type IS 'Tipo de cuenta bancaria RD: Ahorro o Corriente';

-- Verification query (run after migration):
-- SELECT id, bank_name, bank_account, bank_account_type, bank_cedula
-- FROM user_profiles
-- WHERE bank_name IS NOT NULL
-- LIMIT 10;
