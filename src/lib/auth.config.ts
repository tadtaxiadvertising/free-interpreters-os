import type { NextAuthConfig } from "next-auth";

/**
 * RBAC Auth Configuration — Edge-compatible subset
 * Contains configuration that can run on the Edge Runtime (no Prisma/Node modules).
 */
export const authConfig = {
  providers: [], // Providers will be added in the main auth-rbac.ts
  session: { 
    strategy: "jwt", 
    maxAge: 8 * 60 * 60 // 8h session
  }, 
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/portal-rbac/login",
  },
} satisfies NextAuthConfig;
