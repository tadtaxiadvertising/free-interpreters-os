import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  console.log('Testing Prisma connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'PRESENT' : 'MISSING');

  if (!process.env.DATABASE_URL) return;

  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const count = await prisma.interpreter.count();
    console.log('Successfully connected! Interpreter count:', count);
    
    // Try to create a dummy interpreter (transactionally to roll back)
    try {
      const testInterpreter = await prisma.$transaction(async (tx) => {
        const i = await tx.interpreter.create({
          data: {
            externalId: 'TEST-' + Date.now(),
            name: 'Test Interpreter',
            tariffPerMinute: 0.15,
            status: 'Activo'
          }
        });
        console.log('Successfully created test interpreter:', i.id);
        throw new Error('ROLLBACK'); // Rollback so we don't pollute DB
      });
    } catch (e: any) {
      if (e.message === 'ROLLBACK') {
        console.log('Test creation successful (rolled back).');
      } else {
        throw e;
      }
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await pool.end();
  }
}

test();
