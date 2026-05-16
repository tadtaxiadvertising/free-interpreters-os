import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * UNIFIED MIDDLEWARE — FREE INTERPRETERS OS
 * ============================================================
 * RESPONSABILIDADES:
 *   1. Supabase Session Refresh (SSR)
 *   2. CORS Preflight & Headers
 *   3. Global Auth Guard (NextAuth + Supabase)
 * ============================================================
 */

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://freeinterpreters.com";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  // ── 1. CORS LOGIC ──────────────────────────────────────────
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
  // This updates the response with new session cookies if needed.
  // It also handles internal redirects for the main dashboard.
  const response = await updateSession(req);

  // ── 3. RBAC / NEXTAUTH GUARD ──────────────────────────────
  // The RBAC portal (/portal-rbac) uses Auth.js (NextAuth).
  // We need to check those cookies separately.
  const nextAuthToken = req.cookies.get('next-auth.session-token')?.value || 
                       req.cookies.get('__Secure-next-auth.session-token')?.value;
  
  const isRbacProtectedRoute = pathname.startsWith('/portal-rbac') && 
                                !pathname.startsWith('/portal-rbac/login');

  if (isRbacProtectedRoute && !nextAuthToken) {
    const url = req.nextUrl.clone();
    url.pathname = '/portal-rbac/login';
    return NextResponse.redirect(url);
  }

  // ── 4. API CORS PROPAGATION ────────────────────────────────
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
