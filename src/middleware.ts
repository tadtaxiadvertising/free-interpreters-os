import { type NextRequest, NextResponse } from "next/server";

/**
 * MIDDLEWARE — Zero Latency Stateless Router
 * ────────────────────────────────────────────
 * 1. Auth Stateless: Strictly verifies session via next-auth JWT cookie.
 * 2. CPU Efficiency: No DB calls, no getUser(), no console.logs.
 * 3. Security: Optimized matcher to avoid middleware execution on assets.
 */

const PROTECTED_PATHS = [
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

  // 0. SAFETY VALVE: Absolute bypass for API, Next internals and static assets
  // This prevents any middleware logic (cookies, auth) from running on these paths.
  if (
    pathname.startsWith('/api') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 1. Stateless Session Verification (JWT Presence Only)
  const token = 
    request.cookies.get('next-auth.session-token')?.value || 
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const isAuthenticated = !!token;

  // 2. Route Protection Logic
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// MATCHER MAESTRO: Optimized blacklist to minimize CPU execution
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (backend routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

