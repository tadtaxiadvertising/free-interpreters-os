import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

async function verifyPooler() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Connected to pooler. Verifying table structure...');

    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles'
      ORDER BY ordinal_position;
    `);

    console.log('Columns in user_profiles via pooler:');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });

  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await client.end();
  }
}

verifyPooler();
