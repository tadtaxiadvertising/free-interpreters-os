import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

async function verify() {
  console.log('Testing with DATABASE_URL:', process.env.DATABASE_URL);
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Querying payroll records...');
    const result = await prisma.payrollRecord.findMany({
      take: 1
    });
    console.log('✅ Success! Found records:', result.length);
    if (result.length > 0) {
      console.log('First record verifiedMinutes:', result[0].verifiedMinutes);
    }
  } catch (error) {
    console.error('❌ Prisma Error:');
    console.error(error);
  } finally {
    await pool.end();
  }
}

verify();
