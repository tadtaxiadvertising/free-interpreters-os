import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('Prisma models:');
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !['$connect', '$disconnect', '$on', '$transaction', '$use', '$extends'].includes(k));
  console.log(models);
  await prisma.$disconnect();
}

main().catch(console.error);
