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
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Database features will be disabled.');
    return new PrismaClient(); 
  }
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === 'production' ? 2 : 10, // Reduced to 2 for 457MB VPS
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    adapter,
  });
};

declare global {
  var _prisma: PrismaClient | undefined;
}

// Singleton pattern for Next.js to prevent multiple instances
const prisma = globalThis._prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis._prisma = prisma;

