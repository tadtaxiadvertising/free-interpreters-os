-- ============================================================
-- Migration: Add payroll verification & incentives fields
-- Run this BEFORE deploying the new code.
-- Target: Supabase PostgreSQL (port 6543 pooler)
-- ============================================================

-- 1. Add new columns to payroll_records
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS verified_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS incentives_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Seed SystemConfig with default incentive tiers (if table is empty)
INSERT INTO system_configs (key, value, description, updated_at)
VALUES
  ('tier1_hours', '100', 'Minimum hours for tier 1 incentive', NOW()),
  ('tier1_bonus', '50.00', 'Bonus amount (USD) for tier 1', NOW()),
  ('tier2_hours', '150', 'Minimum hours for tier 2 incentive', NOW()),
  ('tier2_bonus', '100.00', 'Bonus amount (USD) for tier 2', NOW()),
  ('tier3_hours', '200', 'Minimum hours for tier 3 incentive', NOW()),
  ('tier3_bonus', '200.00', 'Bonus amount (USD) for tier 3', NOW())
ON CONFLICT (key) DO NOTHING;
