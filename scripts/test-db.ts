import pg from 'pg';

async function test() {
  process.loadEnvFile();
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  console.log('Testing connection to:', connectionString?.split('@')[1]);
  
  const client = new pg.Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const res = await client.query('SELECT 1 as result');
    console.log('✅ Connection successful:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection failed:', err);
  } finally {
    await client.end();
  }
}

test();
