import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON (OS FRONTEND)
 * Optimizado para evitar "Too many connections" y fugas de recursos.
 * Forzamos max: 1 para respetar el límite del ecosistema en Supabase Transaction Mode.
 */
const globalForPrisma = globalThis as unknown as { _prisma: PrismaClient | undefined };

const prismaClientSingleton = (): PrismaClient => {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Database features will be disabled.');
    return new PrismaClient(); 
  }
  
  const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 1, // Límite estricto para no saturar Supabase
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  });
};

const prisma = globalForPrisma._prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma._prisma = prisma;
