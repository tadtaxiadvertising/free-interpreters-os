import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Prisma models available:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
}

main().catch(console.error);
