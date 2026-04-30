import { PrismaClient } from '@prisma/client';

/**
 * PRISMA CLIENT SINGLETON
 * Standard implementation for Supabase PostgreSQL.
 * Note: We are migrating towards Supabase JS Client, but keeping this 
 * for compatibility with existing Server Actions.
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | PrismaClient;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
