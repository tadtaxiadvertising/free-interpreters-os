const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters';
    `);

    console.log('Columns in "interpreters" table:');
    res.rows.forEach(row => console.log(`- ${row.column_name}`));

    const requiredColumns = ['payment_frequency', 'payment_day'];
    const missing = requiredColumns.filter(col => !res.rows.some(row => row.column_name === col));

    if (missing.length > 0) {
      console.log('\nMISSING COLUMNS:', missing);
    } else {
      console.log('\nAll checked columns exist.');
    }

    // Also check payroll_records for verified_minutes
    const resPayroll = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payroll_records';
    `);
    
    const missingPayroll = ['verified_minutes'].filter(col => !resPayroll.rows.some(row => row.column_name === col));
    if (missingPayroll.length > 0) {
      console.log('MISSING in "payroll_records":', missingPayroll);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkColumns();
