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
 * FAULT TOLERANCE:
 *   If env vars are missing at build-time or during static generation,
 *   the middleware logs a warning and passes the request through.
 *   This prevents 502 errors from the container orchestrator before
 *   runtime env vars are injected by Easypanel.
 *
 * FLOW:
 *   req → health check bypass
 *       → static assets bypass
 *       → CORS preflight
 *       → RBAC portal guard (Auth.js cookie-based)
 *       → Supabase session refresh (if vars present, non-RBAC routes)
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

if (!HAS_SUPABASE_ENV) {
  console.warn(
    '[MIDDLEWARE] Supabase env vars missing at module load. ' +
    'Supabase session refresh will be skipped. ' +
    'This is expected during `next build` static generation.'
  );
}

/** Routes exclusively managed by Auth.js (NextAuth v5) */
const RBAC_PREFIX = '/portal-rbac';
const RBAC_LOGIN_PATH = '/portal-rbac/login';

/** Routes exclusively managed by Supabase Auth */
const SUPABASE_SECURE_PREFIXES = ['/dashboard', '/admin', '/payroll', '/qa'] as const;

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

  // ── 2. RBAC PORTAL GUARD (Auth.js / NextAuth v5) ──────────
  // /portal-rbac/* routes are managed EXCLUSIVELY by Auth.js.
  // Supabase must NEVER interfere with these routes.
  if (pathname.startsWith(RBAC_PREFIX)) {
    // Allow unauthenticated access to the login, forgot-password and reset-password pages
    const isPublicRbacRoute = 
      pathname === RBAC_LOGIN_PATH || 
      pathname === '/portal-rbac/forgot-password' || 
      pathname.startsWith('/portal-rbac/reset-password');

    if (isPublicRbacRoute) {
      return NextResponse.next();
    }

    // Check for Auth.js session cookies (v5 + legacy variants)
    const hasRbacSession =
      req.cookies.has('authjs.session-token') ||
      req.cookies.has('__Secure-authjs.session-token') ||
      req.cookies.has('next-auth.session-token') ||
      req.cookies.has('__Secure-next-auth.session-token');

    if (!hasRbacSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = RBAC_LOGIN_PATH;
      return NextResponse.redirect(loginUrl);
    }

    // RBAC routes pass through without Supabase session refresh
    return NextResponse.next();
  }

  // ── 3. SUPABASE SESSION REFRESH ───────────────────────────
  // Conditionally imported to prevent crashes when env vars are
  // missing during `next build` static generation phase.
  // Only applies to non-RBAC, non-auth-API routes.
  let response: NextResponse;

  const isAuthApiRoute = pathname.startsWith('/api/auth');

  if (HAS_SUPABASE_ENV && !isAuthApiRoute) {
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

  // ── 4. SUPABASE AUTH PROTECTION ───────────────────────────
  // Dashboard/Admin/Payroll/QA routes require a Supabase session.
  const isSupabaseSecureRoute = SUPABASE_SECURE_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix)
  );

  if (isSupabaseSecureRoute) {
    // Check for Supabase auth cookies (multiple possible naming patterns)
    const hasSupabaseSession =
      req.cookies.has('sb-access-token') ||
      // Supabase SSR uses project-ref based cookie names
      Array.from(req.cookies.getAll()).some(
        (cookie) =>
          cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
      );

    if (!hasSupabaseSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 5. API CORS HEADERS ───────────────────────────────────
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
