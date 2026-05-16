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
    // Removed allowExitOnIdle: true to prevent pool closure during health checks
  });

  pool.on('error', (err) => {
    // Silenciar errores de conexión durante el build
    if (process.env.NODE_ENV !== 'production' || !connectionString) return;
    console.error('🔴 PG POOL ERROR (interpreters):', err.message);
  });

  globalForPrisma._pool = pool;
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  });

  // Protect against pool.end() calls by neutralizing it in production if possible
  // or at least logging who called it.
  if (process.env.NODE_ENV === 'production') {
    const originalEnd = pool.end.bind(pool);
    pool.end = async () => {
      console.warn('⚠️ PRISMA: pool.end() was called! (interpreters)');
      console.trace('Pool closure stack trace:');
      // If we are NOT in a shutdown phase, this is likely a bug
      if (!(globalThis as any)._isShuttingDown) {
        console.error('❌ PRISMA: pool.end() called unexpectedly (interpreters)');
        return; // Prevent ending the pool if not shutting down
      }
      return originalEnd();
    };
  }

  return client;
}

export const prisma = globalForPrisma._prisma ?? createPrismaClient();
globalForPrisma._prisma = prisma;

export default prisma;
