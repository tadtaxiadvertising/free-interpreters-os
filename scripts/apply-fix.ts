import 'dotenv/config';
import prisma from '../src/lib/prisma';

async function applyFix() {
  try {
    console.log('--- APPLYING DATABASE SCHEMA FIXES ---');
    
    // Using $executeRawUnsafe for DDL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Monthly';
    `);
    console.log('✅ payment_frequency added to interpreters');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS payment_day TEXT DEFAULT '1';
    `);
    console.log('✅ payment_day added to interpreters');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;
    `);
    console.log('✅ verified_minutes added to payroll_records');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS verified_minutes INTEGER;
    `);
    console.log('✅ verified_minutes added to production_logs');

    console.log('\n--- VERIFYING ---');
    const interpretersColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters' AND column_name IN ('payment_frequency', 'payment_day');
    `) as any[];
    
    console.log('Found columns in "interpreters":', interpretersColumns.map(c => c.column_name));

    console.log('\nSCHEMA FIX COMPLETED SUCCESSFULLY');

  } catch (err) {
    console.error('Error applying fix:', err);
  } finally {
    await prisma.$disconnect();
  }
}

applyFix();
