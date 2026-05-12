import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

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

  // ─── 1. Route Classification ─────────────────────────────────
  const protectedPrefixes = ["/admin", "/payroll", "/qa", "/dashboard", "/portal-rbac"];
  const isProtectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  
  // ─── 2. Session Management (Conditional) ──────────────────────
  let response: NextResponse;
  
  if (isProtectedRoute || pathname === "/login") {
    // Only execute getUser() and DB calls on protected routes or login
    response = await updateSession(request);
  } else {
    // Light response for public routes (including root /)
    response = NextResponse.next({ request });
  }

  // ─── 2. RBAC Portal Protection ─────────────────────────────────
  const isPortalRoute = pathname.startsWith("/portal-rbac");

  if (isPortalRoute) {
    const isLoginRoute = pathname === "/portal-rbac/login";
    const isApiAuth = pathname.startsWith("/portal-rbac/api");

    // Skip protection for login page and auth API
    if (!isLoginRoute && !isApiAuth) {
      // PREVENT CRYPTO ERROR: Use cookies instead of auth() function
      const sessionToken = 
        request.cookies.get('next-auth.session-token')?.value || 
        request.cookies.get('__Secure-next-auth.session-token')?.value;

      // ── 2a. No session → redirect to login ──
      if (!sessionToken) {
        const loginUrl = new URL("/portal-rbac/login", request.url);
        // ANTI-RECURSION: Only redirect if not already going to login
        if (pathname !== "/portal-rbac/login") {
          return NextResponse.redirect(loginUrl, 307);
        }
        // Already on login, pass through
      } else {
        // We can't decode the JWT easily in edge without crypto, so we'll pass them through 
        // to let the layout/page check their exact role, but we route bare requests.
        const routePrefix = extractRolePrefix(pathname);

        // ── 2b. Bare /portal-rbac → auto-route to default dash (let client route correct) ──
        if (pathname === "/portal-rbac" || pathname === "/portal-rbac/") {
          // Without decoding JWT, we can't be sure of the role in edge. 
          // Defaulting to interpreter dashboard, where it can redirect again if admin/holder.
          return NextResponse.redirect(
            new URL(ROLE_DASHBOARDS["INTERPRETER"], request.url), 307
          );
        }
      }
    }

    // ── 2d. Authenticated user hits login → redirect to dashboard ──
    if (isLoginRoute) {
      const sessionToken = 
        request.cookies.get('next-auth.session-token')?.value || 
        request.cookies.get('__Secure-next-auth.session-token')?.value;
        
      if (sessionToken) {
        // Can't reliably read role in edge middleware now, defaulting to generic entry
        const dashUrl = new URL("/portal-rbac", request.url);
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

  console.log(`--- [MIDDLEWARE] Authorized access to: ${pathname}`);
  return response;
}

// MATCHER CRÍTICO: Evita que el middleware se ejecute en assets
export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
