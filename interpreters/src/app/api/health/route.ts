import { NextResponse } from 'next/server';

/**
 * LIGHTWEIGHT HEALTHCHECK — /api/health
 * ============================================================
 * Designed for Easypanel Heartbeats in the Interpreters sub-service.
 * Bypasses heavy DB checks to prevent CrashLoops during startup.
 * ============================================================
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "interpreters-subservice"
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    }
  );
}
