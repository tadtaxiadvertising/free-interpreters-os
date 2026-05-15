const { Client } = require('pg');
require('dotenv').config();

async function checkPayrollColumns() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payroll_records';
    `);
    
    console.log("Columns in 'payroll_records' table:");
    console.log(res.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

checkPayrollColumns();
