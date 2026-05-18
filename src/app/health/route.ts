import { NextResponse } from 'next/server';

/**
 * HEALTH CHECK — /health (ROOT FALLBACK)
 * ============================================================
 * MISSION: Keep the Easypanel container alive when the backend service 
 * (interpreters-api) is built using the root Next.js Dockerfile by mistake.
 *
 * DESIGN:
 *   1. `force-dynamic` prevents Next.js from caching this as a
 *      static page during the build phase.
 *   2. Returns 200 with `{ status: "healthy" }` unconditionally.
 *      This is a PURE liveness probe — no DB, no I/O, no auth.
 *   3. The health endpoint is bypassed by the middleware (no auth,
 *      no Supabase session refresh, no CORS overhead).
 * ============================================================
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'free-interpreters-os-fallback',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
