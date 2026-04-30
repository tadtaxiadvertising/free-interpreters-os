import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON
 * Standard implementation for Supabase PostgreSQL.
 * Note: We are migrating towards Supabase JS Client, but keeping this 
 * for compatibility with existing Server Actions.
 */
const prismaClientSingleton = (): PrismaClient => {
  if (!process.env.DATABASE_URL) {
    console.error('❌ PRISMA: DATABASE_URL is not defined in environment variables.');
  }
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    adapter,
  });
};

declare global {
  var _prisma: undefined | PrismaClient;
}

// Use a Proxy to lazily instantiate the Prisma Client
// This prevents Next.js page data collection from throwing Edge environment errors
const prisma = new Proxy({} as PrismaClient, {
  get: (target, prop) => {
    if (!globalThis._prisma) {
      globalThis._prisma = prismaClientSingleton();
    }
    const value = (globalThis._prisma as any)[prop];
    return typeof value === 'function' ? value.bind(globalThis._prisma) : value;
  }
});

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis._prisma = globalThis._prisma || prismaClientSingleton();
