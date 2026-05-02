import pg from 'pg';
import 'dotenv/config';

async function check() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log('Using connection:', connectionString?.split('@')[1]); // Show host for verification

  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payroll_records'
    `);
    console.log('Columns in payroll_records:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

check();
