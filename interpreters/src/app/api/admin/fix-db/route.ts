import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const client = await pool.connect();
    
    // Add columns to interpreters
    await client.query(`
      ALTER TABLE interpreters 
      ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Monthly',
      ADD COLUMN IF NOT EXISTS payment_day TEXT DEFAULT '1';
    `);

    // Add columns to production_logs
    await client.query(`
      ALTER TABLE production_logs 
      ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;
    `);

    // Add columns to payroll_records
    await client.query(`
      ALTER TABLE payroll_records 
      ADD COLUMN IF NOT EXISTS verified_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS incentives_total DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
      ADD COLUMN IF NOT EXISTS reconciliation_hash TEXT UNIQUE;
    `);

    client.release();
    await pool.end();

    return NextResponse.json({
      success: true,
      message: "Database schema successfully patched with all missing columns!",
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || 'Missing',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}
