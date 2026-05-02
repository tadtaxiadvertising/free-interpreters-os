import prisma from '../src/lib/prisma.js';

async function prismaRawVerify() {
  try {
    console.log('🚀 Querying information_schema via Prisma raw query...');
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
    process.exit(0);
  }
}

prismaRawVerify();
