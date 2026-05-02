import pg from 'pg';
const { Client } = pg;

const DIRECT_URL = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function runMigration() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Connected to database. Applying hotfix...');

    // Add bank_account_type
    await client.query(`
      ALTER TABLE user_profiles 
      ADD COLUMN IF NOT EXISTS bank_account_type TEXT;
    `);
    console.log('✅ Column bank_account_type added.');

    // Add comment
    await client.query(`
      COMMENT ON COLUMN user_profiles.bank_account_type IS 'Tipo de cuenta bancaria RD: Ahorro o Corriente';
    `);
    console.log('✅ Comment added.');

    // Double check other fields just in case
    await client.query(`
      ALTER TABLE user_profiles 
      ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
    `);
    console.log('✅ Column onboarding_complete verified.');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigration();
