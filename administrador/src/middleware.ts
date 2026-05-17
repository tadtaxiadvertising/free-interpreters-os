import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * PERIMETER MIDDLEWARE — Dual Auth Anti-Loop Controller
 * ============================================================
 * ARCHITECTURE:
 *   This middleware operates on the Edge Runtime and handles TWO
 *   completely independent authentication systems:
 *
 *   1. SUPABASE AUTH (Dashboard):
 *      Protects /dashboard/*, /interpreters/*, /payroll/*, /qa/*,
 *      /production/*, /recruitment/*, /settings/*
 *      → Supabase SSR manages sessions via its own cookies.
 *      → The middleware does NOT interfere; Supabase layouts and
 *        Server Actions handle their own redirects.
 *
 *   2. AUTH.JS / NextAuth v5 (RBAC Portal):
 *      Protects /portal-rbac/admin/*, /portal-rbac/holder/*,
 *      /portal-rbac/interpreter/*
 *      → Uses JWT stored in `authjs.session-token` (or `__Secure-` prefix).
 *      → The middleware checks cookie presence (NOT validity — the
 *        Auth.js JWT callback handles token verification server-side).
 *
 * ANTI-LOOP STRATEGY:
 *   1. Public paths (login, forgot, reset, health, static, API) are
 *      whitelisted and pass through immediately.
 *   2. RBAC-protected paths check for cookie presence ONCE. If missing,
 *      the middleware issues a single 307 redirect to login.
 *   3. The redirect target (/portal-rbac/login) is whitelisted, so it
 *      never re-enters the protection logic → no loop.
 *   4. If Auth.js's internal `authorized` callback also redirects,
 *      the middleware's whitelist prevents re-evaluation.
 *
 * EDGE SAFETY:
 *   This file MUST NOT import prisma, pg, bcryptjs, or any Node.js-only
 *   module. It runs on Vercel/Easypanel's Edge Runtime (V8 Isolates).
 * ============================================================
 */

// ── Paths that NEVER need middleware protection ─────────────
const PUBLIC_PATHS = [
  "/portal-rbac/login",
  "/portal-rbac/forgot-password",
  "/portal-rbac/reset-password",
  "/portal-rbac/debug-auth",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/api",
  "/_next",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ── Paths that require Auth.js RBAC authentication ──────────
const RBAC_PROTECTED_PREFIXES = [
  "/portal-rbac/admin",
  "/portal-rbac/holder",
  "/portal-rbac/interpreter",
];

function isRbacProtected(pathname: string): boolean {
  return RBAC_PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. BYPASS: Public paths, static assets, API routes ────
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── 2. RBAC PORTAL: Check for Auth.js session cookie ──────
  if (isRbacProtected(pathname)) {
    // Auth.js v5 uses `authjs.session-token` (dev) or
    // `__Secure-authjs.session-token` (production with HTTPS)
    const hasSession =
      request.cookies.has("authjs.session-token") ||
      request.cookies.has("__Secure-authjs.session-token");

    if (!hasSession) {
      // Single redirect to login — the login page is whitelisted above,
      // so the middleware will not re-evaluate it → no loop.
      const loginUrl = new URL("/portal-rbac/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl, 307);
    }

    // Cookie exists → let Auth.js's server-side callbacks verify it.
    // If the JWT is expired/invalid, Auth.js will handle the redirect
    // internally via the `authorized` callback in auth.config.ts.
    return NextResponse.next();
  }

  // ── 3. PORTAL ROOT: Redirect to login if no session ───────
  if (pathname === "/portal-rbac") {
    const hasSession =
      request.cookies.has("authjs.session-token") ||
      request.cookies.has("__Secure-authjs.session-token");

    if (!hasSession) {
      return NextResponse.redirect(
        new URL("/portal-rbac/login", request.url),
        307
      );
    }
    return NextResponse.next();
  }

  // ── 4. ALL OTHER PATHS: Pass through ──────────────────────
  // Supabase-protected routes (/dashboard/*, /interpreters/*, etc.)
  // handle their own authentication in layouts and Server Actions.
  // The middleware does NOT gate-keep them — Supabase SSR cookies
  // are verified server-side by createClient() in each route.
  return NextResponse.next();
}

// ── Matcher Configuration ───────────────────────────────────
// Only run middleware on paths that could potentially need protection.
// Exclude static files, images, and the health check endpoint.
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     * - api/* (API routes handle their own auth)
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
