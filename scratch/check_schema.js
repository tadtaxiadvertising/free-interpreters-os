import pg from 'pg';
const { Client } = pg;

const DIRECT_URL = "postgresql://postgres.kzbkygppplknynrwmtmf:gjkDNBlZuVr9leTw@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

async function checkSchema() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🚀 Connected to database. Checking schema for user_profiles...');

    const res = await client.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'bank_account_type'
    `);

    console.log('Results:');
    res.rows.forEach(row => {
      console.log(`- Schema: ${row.table_schema}, Table: ${row.table_name}, Column: ${row.column_name}`);
    });

  } catch (err) {
    console.error('❌ Check failed:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
