import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON (ADMIN PORTAL)
 * ============================================================
 * Optimizado para evitar "Too many connections" y fugas de recursos.
 * ============================================================
 */

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined;
  _pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Providing dummy adapter for Prisma 7 validation.');
    // Usamos un pool vacío para satisfacer al constructor de Prisma 7 durante el build.
    // Las consultas fallarán en runtime si no se provee una URL real, lo cual es correcto.
    const pool = new pg.Pool();
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ 
      adapter, 
      log: ['error'] 
    });
  }

  const pool = new pg.Pool({
    connectionString: dbUrl,
    max: 1, // Límite estricto para portales (comparten pool con el core)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });

  pool.on('error', (err) => {
    console.error('🔴 PG POOL ERROR (administrador):', err.message);
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

    console.log('🔄 PRISMA: Graceful shutdown initiated (administrador)...');
    try {
      await prisma.$disconnect();
      if (globalForPrisma._pool) {
        await globalForPrisma._pool.end();
        globalForPrisma._pool = undefined;
      }
      console.log('✅ PRISMA: Pool closed cleanly (administrador).');
    } catch (err) {
      console.error('⚠️ PRISMA: Error during shutdown:', err instanceof Error ? err.message : err);
    }
  };

  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
