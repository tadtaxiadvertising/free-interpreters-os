import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function prismaRawVerify() {
  try {
    console.log('🚀 Querying information_schema via Prisma raw query (Manual Client)...');
    const res = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_profiles'
      ORDER BY ordinal_position;
    `;
    
    console.log('Columns seen by Prisma:');
    console.log(JSON.stringify(res, null, 2));

  } catch (err) {
    console.error('❌ Prisma raw query failed:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

prismaRawVerify();
