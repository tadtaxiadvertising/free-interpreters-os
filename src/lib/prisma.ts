import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PRISMA CLIENT SINGLETON — Serverless/Edge Optimized
 * ============================================================
 * 
 * PROBLEMA QUE RESUELVE:
 *   En entornos Serverless (y standalone Next.js), cada hot-reload o
 *   cold-start intenta crear un nuevo PrismaClient + pg.Pool.
 *   Sin singleton → "Too many connections" en Supabase Free (max ~20).
 * 
 * SOLUCIÓN:
 *   1. Cachea PrismaClient en `globalThis` (sobrevive hot-reloads)
 *   2. Pool limitado a max: 2 (1 activa + 1 en espera)
 *   3. idle timeout agresivo (20s) para liberar conexiones rápido
 *   4. connection timeout de 5s para fallar rápido si PgBouncer está saturado
 *   5. Hook de shutdown graceful para cerrar pool en SIGTERM (Docker stop)
 * 
 * CONEXIÓN:
 *   DATABASE_URL debe apuntar a PgBouncer (puerto 6543) con ?pgbouncer=true
 *   Ejemplo: postgresql://user:pass@pooler.supabase.com:6543/postgres?pgbouncer=true
 * 
 * ============================================================
 */

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined;
  _pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ PRISMA: DATABASE_URL is missing. Database features will be disabled.');
    // Fallback sin adapter — las queries fallarán pero el server no crashea
    return new PrismaClient({ log: ['error'] });
  }

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // ── Pool Sizing ──────────────────────────────────────
    // Supabase Free: ~20 conexiones max compartidas entre todos los servicios.
    // Con 4 servicios (API, Admin, Owner, Interpreter), cada uno tiene max 2.
    max: 2,
    min: 0, // No mantener conexiones ociosas innecesariamente
    // ── Timeouts ─────────────────────────────────────────
    idleTimeoutMillis: 20000,      // Libera conexiones ociosas en 20s
    connectionTimeoutMillis: 5000, // Falla rápido si PgBouncer no responde
    // ── Manejo de errores ────────────────────────────────
    allowExitOnIdle: true,         // Permite que el proceso salga si el pool está vacío
  });

  // Log de errores del pool (no crashea el proceso)
  pool.on('error', (err) => {
    console.error('🔴 PG POOL ERROR (non-fatal):', err.message);
  });

  // Guardamos referencia global para shutdown graceful
  globalForPrisma._pool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error', 'warn'],
    adapter,
  });
}

// ── Singleton Export ─────────────────────────────────────────
const prisma = globalForPrisma._prisma ?? createPrismaClient();

// Cache en TODOS los entornos (dev + production)
// En dev previene warnings de "multiple PrismaClient instances"
// En production previene pool exhaustion por cold-starts
globalForPrisma._prisma = prisma;

export default prisma;

// ── Shutdown Graceful ────────────────────────────────────────
// Cuando Docker envía SIGTERM (Easypanel restart/redeploy),
// cerramos el pool limpiamente para no dejar conexiones fantasma
// en Supabase que consumen el límite del plan gratuito.
if (typeof process !== 'undefined') {
  const shutdown = async () => {
    console.log('🔄 PRISMA: Graceful shutdown initiated...');
    try {
      await prisma.$disconnect();
      if (globalForPrisma._pool) {
        await globalForPrisma._pool.end();
      }
      console.log('✅ PRISMA: Pool closed cleanly.');
    } catch (err) {
      console.error('⚠️ PRISMA: Error during shutdown:', err);
    }
  };

  // Evita registrar múltiples listeners en hot-reload
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
