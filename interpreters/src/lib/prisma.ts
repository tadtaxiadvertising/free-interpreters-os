import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON (INTERPRETER PORTAL)
 * ============================================================
 * Optimizado para evitar "Too many connections" y fugas de recursos.
 * ============================================================
 */

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined;
  _pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Providing dummy adapter for Prisma 7 validation.');
    const pool = new pg.Pool();
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ 
      adapter, 
      log: ['error'] 
    });
  }

  const pool = new pg.Pool({
    connectionString: connectionString || undefined,
    max: 1, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

  pool.on('error', (err) => {
    // Silenciar errores de conexión durante el build
    if (process.env.NODE_ENV !== 'production' || !connectionString) return;
    console.error('🔴 PG POOL ERROR (interpreters):', err.message);
  });

  globalForPrisma._pool = pool;
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  });
}

export const prisma = globalForPrisma._prisma ?? createPrismaClient();
globalForPrisma._prisma = prisma;

export default prisma;
