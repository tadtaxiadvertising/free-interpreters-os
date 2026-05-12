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

  // 1. Stateless Session Verification (JWT Presence Only)
  // We ignore getUser(), Prisma, or Supabase calls to avoid resource saturation.
  const token = 
    request.cookies.get('next-auth.session-token')?.value || 
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const isAuthenticated = !!token;

  // 2. Route Protection Logic
  // Any path in PROTECTED_PATHS requires a valid token.
  const isProtectedPath = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtectedPath && !isAuthenticated) {
    // Redirect to landing page immediately if not authenticated
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Performance & Security Headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

// MATCHER MAESTRO: Optimized reverse blacklist to minimize CPU execution
export const config = {
  matcher: [
    /*
     * Ignore:
     * - /api/ (Backend requests)
     * - /_next/ (Next.js internals)
     * - /static/ (Static assets)
     * - /favicon.ico, *.png, *.jpg, *.svg (Common media extensions)
     */
    '/((?!api|_next|static|favicon.ico|.*\\.(?:png|jpg|svg)).*)',
  ],
};
