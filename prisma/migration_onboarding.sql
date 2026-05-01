-- Migration: Add onboarding fields to user_profiles + monthly_goal to interpreters
-- Run this against your Supabase database before deploying

-- 1. Add monthly_goal to interpreters
ALTER TABLE interpreters
  ADD COLUMN IF NOT EXISTS monthly_goal INTEGER NOT NULL DEFAULT 2000;

-- 2. Add onboarding/banking fields to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS bank_cedula TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- 3. Index for quick onboarding status checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding
  ON user_profiles (onboarding_complete)
  WHERE onboarding_complete = false;
