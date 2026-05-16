import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * UNIFIED MIDDLEWARE — FREE INTERPRETERS OS
 * ============================================================
 * DUAL-AUTH COORDINATION:
 *   1. Supabase Auth  → Main dashboard (/admin, /dashboard, etc.)
 *   2. Auth.js (RBAC) → Portal RBAC   (/portal-rbac/*)
 *
 * CRITICAL DESIGN CONSTRAINTS (Easypanel / ~457 MB RAM):
 *   - Health check bypass MUST be the first check (no I/O)
 *   - Environment variable guards prevent build-time crashes
 *   - Supabase session refresh is conditionally loaded
 *   - RBAC guard uses cookie inspection (no DB call in middleware)
 *
 * FLOW:
 *   req → health check bypass
 *       → CORS preflight
 *       → Supabase session refresh (if vars present)
 *       → RBAC portal guard (cookie-based)
 *       → API CORS headers
 *       → response
 * ============================================================
 */

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://freeinterpreters.com";

// Pre-check: can we run Supabase middleware?
const HAS_SUPABASE_ENV = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  // ── 0. HEALTH CHECK — INSTANT EXIT ────────────────────────
  // Zero I/O, zero DB, zero auth. Keeps Easypanel happy.
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // ── 1. CORS PREFLIGHT ─────────────────────────────────────
  const isTrustedOrigin = !origin ||
    origin === FRONTEND_ORIGIN ||
    origin.endsWith('.easypanel.host') ||
    origin.includes('localhost');

  const corsOrigin = isTrustedOrigin && origin ? origin : FRONTEND_ORIGIN;

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ── 2. SUPABASE SESSION REFRESH ───────────────────────────
  // Conditionally imported to prevent crashes when env vars are
  // missing during `next build` static generation phase.
  let response: NextResponse;

  if (HAS_SUPABASE_ENV && !pathname.startsWith('/portal-rbac') && !pathname.startsWith('/api/auth')) {
    try {
      const { updateSession } = await import('@/lib/supabase/middleware');
      response = await updateSession(req);
    } catch (err) {
      console.warn(
        '[MIDDLEWARE] Supabase session refresh failed, passing through:',
        err instanceof Error ? err.message : err
      );
      response = NextResponse.next({ request: req });
    }
  } else {
    response = NextResponse.next({ request: req });
  }

  // ── 3. RBAC PORTAL GUARD ──────────────────────────────────
  // The /portal-rbac/* routes use Auth.js (NextAuth v5).
  // We inspect the JWT session cookie directly — NO database call.
  // Auth.js sets either `authjs.session-token` (v5) or the legacy
  // `next-auth.session-token` / `__Secure-next-auth.session-token`.
  const isRbacProtectedRoute =
    pathname.startsWith('/portal-rbac') &&
    !pathname.startsWith('/portal-rbac/login');

  if (isRbacProtectedRoute) {
    const hasRbacSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token') ||
      req.cookies.has('next-auth.session-token') ||
      req.cookies.has('__Secure-next-auth.session-token');

    if (!hasRbacSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/portal-rbac/login';

      const redirectResponse = NextResponse.redirect(loginUrl);

      // Preserve Supabase cookies even when redirecting for RBAC
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });

      return redirectResponse;
    }
  }

  // ── 4. API CORS HEADERS ───────────────────────────────────
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
