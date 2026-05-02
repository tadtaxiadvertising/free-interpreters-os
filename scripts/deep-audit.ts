import pg from 'pg';
import 'dotenv/config';

async function run() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_schema, table_name, column_name 
      FROM information_schema.columns 
      WHERE column_name = 'verified_minutes'
    `);
    console.log('--- FOUND COLUMNS ---');
    console.log(res.rows);
    
    const res2 = await client.query(`SELECT current_database(), current_schema()`);
    console.log('--- CURRENT DB/SCHEMA ---');
    console.log(res2.rows);

    const res3 = await client.query(`SELECT count(*) FROM payroll_records`);
    console.log('--- PAYROLL RECORDS COUNT ---');
    console.log(res3.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

run();
