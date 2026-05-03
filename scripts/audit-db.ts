import prisma from '../src/lib/prisma';

async function checkSchema() {
  try {
    console.log('--- AUDITING INTERPRETERS TABLE ---');
    const interpretersColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'interpreters';
    `) as any[];
    
    console.log('Current columns:', interpretersColumns.map(c => c.column_name).join(', '));
    
    const expectedInterpreters = ['payment_frequency', 'payment_day'];
    const missingInterpreters = expectedInterpreters.filter(col => 
      !interpretersColumns.some(c => c.column_name === col)
    );
    
    if (missingInterpreters.length > 0) {
      console.log('MISSING COLUMNS in "interpreters":', missingInterpreters);
    } else {
      console.log('All expected columns exist in "interpreters".');
    }

    console.log('\n--- AUDITING PAYROLL_RECORDS TABLE ---');
    const payrollColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payroll_records';
    `) as any[];
    
    const expectedPayroll = ['verified_minutes'];
    const missingPayroll = expectedPayroll.filter(col => 
      !payrollColumns.some(c => c.column_name === col)
    );
    
    if (missingPayroll.length > 0) {
      console.log('MISSING COLUMNS in "payroll_records":', missingPayroll);
    } else {
      console.log('All expected columns exist in "payroll_records".');
    }

    console.log('\n--- AUDITING PRODUCTION_LOGS TABLE ---');
    const prodColumns = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'production_logs';
    `) as any[];
    
    const expectedProd = ['verified_minutes'];
    const missingProd = expectedProd.filter(col => 
      !prodColumns.some(c => c.column_name === col)
    );
    
    if (missingProd.length > 0) {
      console.log('MISSING COLUMNS in "production_logs":', missingProd);
    } else {
      console.log('All expected columns exist in "production_logs".');
    }

  } catch (err) {
    console.error('Error during audit:', err);
  } finally {
    await (prisma as any).$disconnect();
  }
}

checkSchema();
