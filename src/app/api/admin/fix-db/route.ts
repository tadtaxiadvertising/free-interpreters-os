import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { apiError } from '@/lib/api-responses';
import { validateAction } from '@/lib/auth/actions';

export async function GET() {
  try {
    const auth = await validateAction(['admin']);
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    await prisma.$executeRawUnsafe(`
      ALTER TABLE interpreters 
      ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Monthly',
      ADD COLUMN IF NOT EXISTS payment_day TEXT DEFAULT '1';
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE production_logs 
      ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE payroll_records 
      ADD COLUMN IF NOT EXISTS verified_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS incentives_total DECIMAL(10, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
      ADD COLUMN IF NOT EXISTS reconciliation_hash TEXT UNIQUE;
    `);

    return NextResponse.json({
      success: true,
      message: "Database schema successfully patched with all missing columns!",
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) || 'Missing',
    });
  } catch (error) {
    return apiError({ error, fallback: 'Database schema patch failed' });
  }
}
