import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-rbac-edge";

/**
 * MIDDLEWARE — Bulletproof RBAC Router
 * ────────────────────────────────────
 * 1. Supabase session refresh for legacy app routes.
 * 2. RBAC Portal protection with intelligent role-based redirects.
 * 3. Anti-recursion guard: Never redirect TO a URL we're already ON.
 * 4. Security headers applied to all responses.
 */

const ROLE_DASHBOARDS: Record<string, string> = {
  ADMIN: "/portal-rbac/admin/dashboard",
  HOLDER: "/portal-rbac/holder/dashboard",
  INTERPRETER: "/portal-rbac/interpreter/dashboard",
};

const ROLE_PREFIXES = ["admin", "holder", "interpreter"] as const;

function extractRolePrefix(
  pathname: string
): (typeof ROLE_PREFIXES)[number] | null {
  // Matches /portal-rbac/{role}/...
  const match = pathname.match(
    /^\/portal-rbac\/(admin|holder|interpreter)(\/|$)/
  );
  return match ? (match[1] as (typeof ROLE_PREFIXES)[number]) : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Supabase Session Management (Legacy / Main App) ────────
  let response = await updateSession(request);

  // ─── 2. RBAC Portal Protection ─────────────────────────────────
  const isPortalRoute = pathname.startsWith("/portal-rbac");

  if (isPortalRoute) {
    const isLoginRoute = pathname === "/portal-rbac/login";
    const isApiAuth = pathname.startsWith("/portal-rbac/api");

    // Skip protection for login page and auth API
    if (!isLoginRoute && !isApiAuth) {
      const session = await auth();

      // ── 2a. No session → redirect to login ──
      if (!session?.user) {
        const loginUrl = new URL("/portal-rbac/login", request.url);
        // ANTI-RECURSION: Only redirect if not already going to login
        if (pathname !== "/portal-rbac/login") {
          return NextResponse.redirect(loginUrl, 307);
        }
        // Already on login, pass through
      } else {
        const role = (session.user as any)?.role as string | undefined;
        const routePrefix = extractRolePrefix(pathname);

        // ── 2b. Bare /portal-rbac → auto-route to role dashboard ──
        if (pathname === "/portal-rbac" || pathname === "/portal-rbac/") {
          if (role && ROLE_DASHBOARDS[role]) {
            return NextResponse.redirect(
              new URL(ROLE_DASHBOARDS[role], request.url), 307
            );
          }
          // Unknown role → login
          return NextResponse.redirect(
            new URL("/portal-rbac/login", request.url), 307
          );
        }

        // ── 2c. Role mismatch → redirect to correct dashboard ──
        if (routePrefix) {
          const expectedRole = routePrefix.toUpperCase();
          if (role !== expectedRole) {
            const correctDash =
              ROLE_DASHBOARDS[role || ""] || "/portal-rbac/login";
            const targetUrl = new URL(correctDash, request.url);

            // ANTI-RECURSION: Never redirect to the same path
            if (targetUrl.pathname !== pathname) {
              return NextResponse.redirect(targetUrl, 307);
            }
          }
        }
      }
    }

    // ── 2d. Authenticated user hits login → redirect to dashboard ──
    if (isLoginRoute) {
      const session = await auth();
      const role = (session?.user as any)?.role as string | undefined;
      if (session?.user && role && ROLE_DASHBOARDS[role]) {
        const dashUrl = new URL(ROLE_DASHBOARDS[role], request.url);
        // ANTI-RECURSION: Ensure we're not on that dashboard already
        if (dashUrl.pathname !== pathname) {
          return NextResponse.redirect(dashUrl, 307);
        }
      }
    }
  }

  // ─── 3. Security Hardening Headers ─────────────────────────────
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

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
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set("Content-Security-Policy", cspHeader);

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
    "/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
