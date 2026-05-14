import type { NextAuthConfig } from "next-auth";

/**
 * RBAC Auth Configuration — Edge-compatible subset
 * ============================================================
 * This file contains ONLY the configuration that can run on Edge Runtime.
 * NO Prisma, NO Node.js-only modules, NO database calls.
 *
 * Used by:
 *   - src/middleware.ts (Edge Runtime)
 *   - src/lib/auth-rbac.ts (extends this with providers + DB callbacks)
 *
 * SESSION STRATEGY:
 *   JWT-based (no database sessions) to minimize Supabase connection usage.
 *   8-hour expiration aligns with interpreter shift durations.
 *
 * PAGES:
 *   Custom login page at /portal-rbac/login for role-based portal access.
 * ============================================================
 */
export const authConfig = {
  providers: [], // Providers are added in auth-rbac.ts (server-only)
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — one interpreter shift
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: unknown }).role = token.role;
        (session.user as { id?: unknown }).id = token.id;
      }
      return session;
    },
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const isOnPortal = nextUrl.pathname.startsWith("/portal-rbac");
      const isLoginPage = nextUrl.pathname === "/portal-rbac/login";

      // Allow access to login page always
      if (isLoginPage) return true;

      // Protect all /portal-rbac/* routes
      if (isOnPortal && !isLoggedIn) {
        return Response.redirect(new URL("/portal-rbac/login", nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: "/portal-rbac/login",
  },
} satisfies NextAuthConfig;
