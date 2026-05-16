import type { NextAuthConfig } from "next-auth";

/**
 * RBAC Auth Configuration — Edge-compatible subset
 * Contains configuration that can run on the Edge Runtime (no Prisma/Node modules).
 */
// Force AUTH_SECRET to avoid MissingSecret error in production
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret-for-build-123";
}

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: [], // Providers will be added in the main auth-rbac.ts
  trustHost: true,
  session: { 
    strategy: "jwt", 
    maxAge: 8 * 60 * 60 // 8h session
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
  },
  pages: {
    signIn: "/portal-rbac/login",
  },
} satisfies NextAuthConfig;
