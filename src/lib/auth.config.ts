import type { NextAuthConfig } from "next-auth";

/**
 * RBAC Auth Configuration — Edge-compatible subset
 * ============================================================
 * This file contains ONLY the configuration that can run on Edge Runtime.
 * NO Prisma, NO Node.js-only modules, NO database calls.
 *
 * Used by:
 *   - src/lib/auth-rbac-edge.ts (Edge-compatible NextAuth for middleware)
 *
 * The FULL configuration (with Credentials provider + DB callbacks)
 * lives in src/lib/auth-rbac.ts and re-exports this config's shape.
 * ============================================================
 */

if (typeof process !== "undefined") {
  process.env.AUTH_TRUST_HOST = "true";
}

export const authConfig = {
  secret: process.env.AUTH_SECRET || "fallback-secret-for-build-only",
  providers: [],
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
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

      if (isLoginPage) return true;
      if (isOnPortal && !isLoggedIn) {
        return Response.redirect(new URL("/portal-rbac/login", nextUrl));
      }
      return true;
    },
  },
  pages: {
    signIn: "/portal-rbac/login",
    error: "/portal-rbac/login",
  },
} satisfies NextAuthConfig;
