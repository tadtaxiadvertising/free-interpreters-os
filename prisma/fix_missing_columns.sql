-- Fix missing columns in interpreters table
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Monthly';
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_day TEXT DEFAULT '1';

-- Fix missing columns in payroll_records table
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;

-- Fix missing columns in production_logs table
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;

-- Ensure these columns are indexed if needed
CREATE INDEX IF NOT EXISTS interpreters_payment_frequency_idx ON interpreters(payment_frequency);
