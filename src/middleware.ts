import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth-rbac-edge";

export async function middleware(request: NextRequest) {
  // 1. Supabase Session Management (Legacy / Main App)
  let response = await updateSession(request);

  // 2. RBAC Portal Protection (Auth.js / RBAC)
  const isPortalRoute = request.nextUrl.pathname.startsWith("/portal-rbac");
  const isLoginRoute = request.nextUrl.pathname === "/portal-rbac/login";

  if (isPortalRoute && !isLoginRoute) {
    const session = await auth();
    
    if (!session) {
      const loginUrl = new URL("/portal-rbac/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based directory protection
    const role = (session?.user as any)?.role;
    const path = request.nextUrl.pathname;

    if (path.startsWith("/portal-rbac/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/portal-rbac/login", request.url));
    }
    if (path.startsWith("/portal-rbac/holder") && role !== "HOLDER") {
      return NextResponse.redirect(new URL("/portal-rbac/login", request.url));
    }
    if (path.startsWith("/portal-rbac/interpreter") && role !== "INTERPRETER") {
      return NextResponse.redirect(new URL("/portal-rbac/login", request.url));
    }
  }

  // SECURITY HARDENING HEADERS
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self' https://*.supabase.co;
  `.replace(/\s{2,}/g, ' ').trim();
  
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - api (API routes)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
