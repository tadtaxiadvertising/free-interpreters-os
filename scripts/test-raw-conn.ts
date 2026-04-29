import pg from 'pg';
const { Pool } = pg;

async function testConn() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:sII7sq36zQ3wuRy@db.kzbkygppplknynrwmtmf.supabase.co:5432/postgres",
    connectionTimeoutMillis: 10000,
  });

  console.log('Testing raw PG connection...');
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('SUCCESS!', res.rows[0]);
  } catch (err) {
    console.error('FAILED!', err);
  } finally {
    await pool.end();
  }
}

testConn();
