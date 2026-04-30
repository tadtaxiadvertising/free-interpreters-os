import prisma from './src/lib/prisma.js';

console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
process.exit(0);
