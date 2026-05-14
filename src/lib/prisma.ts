import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON (Frontend Service)
 * ============================================================
 * Optimized for resource-constrained VPS and Supabase Free Tier.
 * Enforces strict connection limits to prevent pool exhaustion.
 * ============================================================
 */

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined;
  _pool: pg.Pool | undefined;
  _prismaShutdownRegistered: boolean | undefined;
  _isShuttingDown: boolean | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Database features will fail.');
    return new PrismaClient({ log: ['error'] });
  }

  // Use PgBouncer compatible pool settings
  const pool = new pg.Pool({
    connectionString,
    max: 2,           // Very tight limit for frontend actions
    min: 0,
    idleTimeoutMillis: 15000,      // Aggressive release
    connectionTimeoutMillis: 5000, // Fail fast
    allowExitOnIdle: true,
  });

  pool.on('error', (err) => {
    console.error('🔴 FRONTEND PG POOL ERROR:', err.message);
  });

  globalForPrisma._pool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error', 'warn'],
    adapter,
  });
}

const prisma = globalForPrisma._prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._prisma = prisma;
}

/**
 * Graceful Warmup
 * Surface connection issues early in the log.
 */
export async function warmupPrisma() {
  try {
    await prisma.$connect();
    console.log('✅ PRISMA: Connection warmed up (free-interpreters-os).');
  } catch (err) {
    console.error('❌ PRISMA: Warmup failed:', err instanceof Error ? err.message : err);
  }
}

export default prisma;

// ── Shutdown Logic ───────────────────────────────────────────
if (typeof process !== 'undefined' && !globalForPrisma._prismaShutdownRegistered) {
  const shutdown = async () => {
    if (globalForPrisma._isShuttingDown) return;
    globalForPrisma._isShuttingDown = true;

    console.log('🔄 PRISMA: Graceful shutdown (free-interpreters-os)...');
    try {
      await prisma.$disconnect();
      if (globalForPrisma._pool) {
        await globalForPrisma._pool.end();
        globalForPrisma._pool = undefined;
      }
      console.log('✅ PRISMA: Connections closed cleanly.');
    } catch (err) {
      console.error('⚠️ PRISMA: Shutdown error:', err);
    }
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  globalForPrisma._prismaShutdownRegistered = true;
}

