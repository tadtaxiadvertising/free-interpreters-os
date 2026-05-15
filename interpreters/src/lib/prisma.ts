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
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Database features will be disabled.');
    return new PrismaClient({ log: ['error'] });
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1, 
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

  pool.on('error', (err) => {
    console.error('🔴 PG POOL ERROR (interpreters):', err.message);
  });

  globalForPrisma._pool = pool;
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  });
}

const prisma = globalForPrisma._prisma ?? createPrismaClient();
globalForPrisma._prisma = prisma;

export default prisma;

// ── Shutdown Graceful ────────────────────────────────────────
if (typeof process !== 'undefined') {
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('🔄 PRISMA: Graceful shutdown initiated (interpreters)...');
    try {
      await prisma.$disconnect();
      if (globalForPrisma._pool) {
        await globalForPrisma._pool.end();
        globalForPrisma._pool = undefined;
      }
      console.log('✅ PRISMA: Pool closed cleanly (interpreters).');
    } catch (err) {
      console.error('⚠️ PRISMA: Error during shutdown:', err instanceof Error ? err.message : err);
    }
  };

  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
