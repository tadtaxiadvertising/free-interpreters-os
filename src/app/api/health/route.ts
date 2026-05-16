import { NextResponse } from 'next/server';
import { getRawPool } from '@/lib/prisma';

/**
 * HEALTH CHECK — /api/health
 * ============================================================
 * MISSION: Keep the Easypanel/Traefik container alive.
 *
 * DESIGN:
 *   1. `force-dynamic` prevents Next.js from caching this as a
 *      static page during the build phase.
 *   2. Uses the raw pg.Pool (NOT Prisma) to execute `SELECT 1`.
 *      This is a sub-10ms round-trip that validates the DB
 *      connection without loading any ORM overhead.
 *   3. On failure, returns 200 with `db: "disconnected"` instead
 *      of 500 — this prevents Easypanel from kill-restarting the
 *      container just because Supabase had a momentary hiccup.
 *      The container stays UP; only the DB is flagged as unhealthy.
 *   4. The health endpoint is bypassed by the middleware (no auth,
 *      no Supabase session refresh, no CORS overhead).
 *
 * EASYPANEL CONFIG:
 *   Health Check Path: /api/health
 *   Health Check Port: 80
 *   Interval: 30s | Timeout: 10s | Start Period: 60s | Retries: 3
 * ============================================================
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const start = Date.now();
  let dbStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    const pool = getRawPool();
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    console.warn(
      '[HEALTH] Database ping failed:',
      err instanceof Error ? err.message : String(err)
    );
  }

  const latencyMs = Date.now() - start;

  return NextResponse.json(
    {
      status: 'ok',
      db: dbStatus,
      latencyMs,
      timestamp: new Date().toISOString(),
      service: 'free-interpreters-os',
      memoryMB: Math.round(process.memoryUsage.rss() / 1_048_576),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Health-Latency': String(latencyMs),
      },
    }
  );
}
