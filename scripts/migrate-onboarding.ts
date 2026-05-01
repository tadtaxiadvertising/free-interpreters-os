/**
 * Onboarding Schema Migration
 * Adds: monthly_goal to interpreters
 *       terms_accepted_at, signature_date, bank_name, bank_account,
 *       bank_cedula, onboarding_complete to user_profiles
 *
 * Run: npm run migrate:onboarding
 */
import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const SQL = `
-- 1. Add monthly_goal to interpreters
ALTER TABLE interpreters
  ADD COLUMN IF NOT EXISTS monthly_goal INTEGER NOT NULL DEFAULT 2000;

-- 2. Add onboarding / banking columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_date     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bank_name          TEXT,
  ADD COLUMN IF NOT EXISTS bank_account       TEXT,
  ADD COLUMN IF NOT EXISTS bank_cedula        TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT false;

-- 3. Sparse index for fast onboarding-incomplete lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding
  ON user_profiles (onboarding_complete)
  WHERE onboarding_complete = false;
`;

async function run() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌  DATABASE_URL / DIRECT_URL is not set in .env');
    process.exit(1);
  }

  // Prefer the direct (non-pooler) URL for DDL statements
  const client = new pg.Client({ connectionString });

  try {
    console.log('🔌  Connecting to database…');
    await client.connect();
    console.log('✅  Connected');

    console.log('🔧  Running onboarding migration…');
    await client.query(SQL);

    console.log('✅  Migration complete!');
    console.log('');
    console.log('   interpreters.monthly_goal          → added (default 2000)');
    console.log('   user_profiles.terms_accepted_at    → added');
    console.log('   user_profiles.signature_date       → added');
    console.log('   user_profiles.bank_name            → added');
    console.log('   user_profiles.bank_account         → added');
    console.log('   user_profiles.bank_cedula          → added');
    console.log('   user_profiles.onboarding_complete  → added (default false)');
    console.log('');
    console.log('👉  Next: restart your dev server — no prisma generate needed.');
  } catch (err) {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
