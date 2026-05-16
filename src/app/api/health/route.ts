import { NextResponse } from 'next/server';

/**
 * LIGHTWEIGHT HEALTHCHECK — /api/health
 * ============================================================
 * Designed for Easypanel Heartbeats.
 * Bypasses heavy DB checks to prevent CrashLoops during startup
 * or when the database is under high load.
 * ============================================================
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "interpreters-api-proxy"
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    }
  );
}
