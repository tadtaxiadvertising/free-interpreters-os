import pg from 'pg';
const { Client } = pg;

const DIRECT_URL = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function forceFix() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Connected to database for force fix...');

    // Aggressive fix: ensure the column exists in public.user_profiles
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_schema = 'public' 
                       AND table_name = 'user_profiles' 
                       AND column_name = 'bank_account_type') THEN
          ALTER TABLE public.user_profiles ADD COLUMN bank_account_type TEXT;
          RAISE NOTICE 'Column bank_account_type added.';
        ELSE
          RAISE NOTICE 'Column bank_account_type already exists.';
        END IF;
      END $$;
    `);

    console.log('✅ Force fix script completed successfully.');

  } catch (err) {
    console.error('❌ Force fix failed:', err);
  } finally {
    await client.end();
  }
}

forceFix();
