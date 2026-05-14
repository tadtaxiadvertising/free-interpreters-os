import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * HEALTHCHECK ENDPOINT — /api/health
 * ============================================================
 * 
 * CONSUMIDORES:
 *   1. Easypanel Docker HEALTHCHECK (cada 30s)
 *   2. Uptime monitors externos (UptimeRobot, etc.)
 *   3. Webhooks de alerta internos
 *   4. Frontend pre-connection validation
 * 
 * DISEÑO:
 *   - SELECT 1 con timeout de 3s (falla rápido, no bloquea el pool)
 *   - Reporta memoria RSS para detectar leaks antes del OOM
 *   - Respuesta <50ms en condiciones normales
 *   - Cache-Control: no-store para evitar falsos positivos
 * 
 * RESPUESTAS:
 *   200 → Servicio y BD operativos
 *   503 → BD inalcanzable o timeout (Easypanel marcará como unhealthy)
 * 
 * ============================================================
 */

// Timeout para la query de salud — 5s es más resiliente para Supabase Free Tier
const HEALTH_QUERY_TIMEOUT_MS = 5000;

export const dynamic = 'force-dynamic'; // Next.js: nunca cachear esta ruta

export async function GET() {
  const start = performance.now();

  try {
    // ── Pre-check: Environment ─────────────────────────
    if (!process.env.DATABASE_URL) {
      throw new Error('CONFIG_ERROR: DATABASE_URL is missing');
    }

    // ── DB Probe con timeout ────────────────────────────
    // Usamos Promise.race para garantizar que el endpoint responde
    // incluso si PgBouncer o Supabase están lentos/colgados.
    const dbResult = await Promise.race([
      prisma.$queryRaw<[{ ok: number }]>`SELECT 1 as ok`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB_TIMEOUT')), HEALTH_QUERY_TIMEOUT_MS)
      ),
    ]);

    const latencyMs = Math.round(performance.now() - start);
    const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

    // ── Respuesta Exitosa ────────────────────────────────
    return NextResponse.json(
      {
        status: 'healthy',
        service: 'interpreters-api',
        version: process.env.npm_package_version || '0.1.0',
        checks: {
          database: {
            status: 'connected',
            latencyMs,
            result: dbResult?.[0]?.ok === 1 ? 'ok' : 'unexpected',
          },
          memory: {
            rssMB: memoryMB,
            // Alerta temprana: si RSS > 120MB en un contenedor de 150MB,
            // algo está mal (leak, cache sin límite, etc.)
            warning: memoryMB > 120 ? 'HIGH_MEMORY_USAGE' : null,
          },
        },
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Response-Time': `${latencyMs}ms`,
        },
      }
    );
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    const isTimeout = error instanceof Error && error.message === 'DB_TIMEOUT';

    console.error('[HEALTH] Check failed:', {
      error: error instanceof Error ? error.message : 'Unknown',
      latencyMs,
      isTimeout,
    });

    // ── Respuesta de Error ───────────────────────────────
    // Status 503 hace que:
    //   - Easypanel HEALTHCHECK falle → reinicia contenedor si supera retries
    //   - Load balancers quiten el nodo del pool
    //   - Monitors envíen alertas
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'interpreters-api',
        checks: {
          database: {
            status: isTimeout ? 'timeout' : 'disconnected',
            latencyMs,
            error: isTimeout
              ? `Database did not respond within ${HEALTH_QUERY_TIMEOUT_MS}ms`
              : 'Connection failed',
          },
          memory: {
            rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
        },
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '10',
          'X-Response-Time': `${latencyMs}ms`,
        },
      }
    );
  }
}
