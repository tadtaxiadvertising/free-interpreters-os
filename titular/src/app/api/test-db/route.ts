import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    const client = await pool.connect();
    
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters' 
      AND column_name = 'payment_frequency';
    `);
    
    client.release();
    await pool.end();

    const hasColumn = res.rows.length > 0;
    
    return NextResponse.json({
      success: true,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || 'Missing',
      hasPaymentFrequency: hasColumn,
      message: hasColumn 
        ? "Column payment_frequency EXISTS in this runtime's database."
        : "Column payment_frequency IS MISSING from this runtime's database!",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
    });
  }
}
