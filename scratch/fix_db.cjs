const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function fixSchema() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No connection string found in .env');
    return;
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database.');

    const sql = `
      -- Fix missing columns in interpreters table
      ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Monthly';
      ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_day TEXT DEFAULT '1';

      -- Fix missing columns in payroll_records table
      ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;

      -- Fix missing columns in production_logs table
      ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;

      -- Ensure these columns are indexed if needed
      CREATE INDEX IF NOT EXISTS interpreters_payment_frequency_idx ON interpreters(payment_frequency);
    `;

    console.log('Applying schema fixes...');
    await client.query(sql);
    console.log('Schema fixes applied successfully.');

    // Verify
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters' AND column_name IN ('payment_frequency', 'payment_day');
    `);
    console.log('Confirmed columns in "interpreters":', res.rows.map(r => r.column_name));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

fixSchema();
