import { type NextRequest, NextResponse } from "next/server";

/**
 * MIDDLEWARE — High-Performance Stateless Router
 * ────────────────────────────────────────────
 * 1. Stateless Auth: Verifies session purely via JWT cookie existence.
 * 2. Database Shield: PROHIBITED calls to getUser() or DB here.
 * 3. Matcher Optimized: Excludes assets, static files, and API routes.
 */

const PROTECTED_ROUTES = [
  "/admin",
  "/payroll",
  "/qa",
  "/production",
  "/recruitment",
  "/interpreters",
  "/dashboard",
  "/portal-rbac"
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Stateless Session Check ──────────────────────────────
  // Check for both NextAuth and Supabase session cookies
  const hasAuthJsSession = 
    request.cookies.get('next-auth.session-token')?.value || 
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const hasSupabaseSession = request.cookies.getAll().some(
    (cookie) => cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );

  const isAuthenticated = !!(hasAuthJsSession || hasSupabaseSession);

  // ─── 2. Route Protection ─────────────────────────────────────
  const isProtectedRoute = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    // Redirect to home if trying to access protected route without session
    return NextResponse.redirect(new URL("/", request.url));
  }

  // ─── 3. Response & Security Headers ──────────────────────────
  const response = NextResponse.next();
  
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

// MATCHER CRÍTICO: Excluye assets, imágenes y API para evitar Middleware Fatigue
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Extensiones: png, jpg, jpeg, svg, gif, webp, ico
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)).*)',
  ],
};

