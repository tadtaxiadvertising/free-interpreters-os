import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getPrisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";

/**
 * RBAC AUTH CONFIGURATION — Auth.js v5 (NextAuth v5)
 * ============================================================
 * ARCHITECTURE: Dual-auth system.
 *   - Supabase Auth: handles the main dashboard (interpreters, admin).
 *   - Auth.js (this file): handles /portal-rbac/* credentials login
 *     against the `rbac_users` table.
 *
 * SESSION STRATEGY: JWT (no database sessions)
 *   - Minimizes connection pool usage on the 5-connection limit.
 *   - 8-hour expiration aligns with interpreter shift windows.
 *
 * CREDENTIAL FLOW:
 *   1. Zod validates email+password format
 *   2. Case-insensitive lookup in `rbac_users` via findFirst
 *   3. bcryptjs compares the submitted password against the stored hash
 *   4. JWT token embeds { id, email, name, role }
 *   5. On each request, the jwt() callback refreshes the role from DB
 *   6. session() callback exposes id + role to the client
 *
 * SECURITY:
 *   - AUTH_SECRET must be set in Easypanel runtime env (not build args)
 *   - AUTH_TRUST_HOST=true is forced for proxy environments
 *   - Fallback secret is used ONLY during `next build` static generation
 * ============================================================
 */

// Force trust host for Easypanel proxy (Traefik → container)
if (typeof process !== "undefined") {
  process.env.AUTH_TRUST_HOST = "true";
}

// ── Zod Schemas ─────────────────────────────────────────────
const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// ── Auth.js Configuration ───────────────────────────────────
const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET || "fallback-secret-for-build-only",
  trustHost: true,

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours — one interpreter shift
  },

  pages: {
    signIn: "/portal-rbac/login",
    error: "/portal-rbac/login",
  },

  providers: [
    CredentialsProvider({
      id: "rbac-credentials",
      name: "RBAC Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        // ── 1. Input Validation ───────────────────────────
        let email: string;
        let password: string;

        try {
          const parsed = LoginSchema.parse(credentials);
          email = parsed.email.toLowerCase().trim();
          password = parsed.password;
        } catch (err) {
          console.error(
            "[AUTH] Zod validation failed:",
            err instanceof z.ZodError ? err.flatten().fieldErrors : err
          );
          return null;
        }

        console.log(`[AUTH] Login attempt for: ${email}`);

        // ── 2. Database Lookup ────────────────────────────
        let user: {
          id: string;
          email: string;
          name: string;
          role: string;
          password: string;
        } | null = null;

        try {
          const prisma = getPrisma();
          user = await prisma.rbacUser.findFirst({
            where: {
              email: {
                equals: email,
                mode: "insensitive",
              },
            },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              password: true,
            },
          });

          if (!user) {
            console.warn(`[AUTH] User NOT FOUND in rbac_users: ${email}`);
            return null;
          }

          console.log(`[AUTH] User found: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
        } catch (dbError) {
          console.error(
            `[AUTH] Database error during lookup for ${email}:`,
            dbError instanceof Error ? dbError.message : dbError
          );
          return null;
        }

        // ── 3. Password Verification ─────────────────────
        try {
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            console.warn(`[AUTH] Password mismatch for: ${email}`);
            return null;
          }
        } catch (compareError) {
          console.error(
            `[AUTH] bcrypt error for ${email}:`,
            compareError instanceof Error ? compareError.message : compareError
          );
          return null;
        }

        console.log(`[AUTH] ✅ Authentication successful: ${email} (${user.role})`);

        // ── 4. Return user (password excluded from JWT) ──
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in: embed role from authorize() return
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        return token;
      }

      // On token refresh: re-fetch role from DB (lean: 1 column)
      // This ensures role changes take effect without re-login.
      if (token.id && typeof token.id === "string") {
        try {
          const prisma = getPrisma();
          const dbUser = await prisma.rbacUser.findUnique({
            where: { id: token.id },
            select: { role: true },
          });
          if (dbUser) {
            token.role = dbUser.role;
          }
        } catch {
          // Silently keep the existing token role on DB failure
          // This prevents session loss during transient DB outages
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
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
};

// ── Export Auth.js Handlers & Utilities ──────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

// Re-export config for the Edge-compatible middleware instance
export { authConfig };

// ── Type Definitions ────────────────────────────────────────
export type RbacSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "HOLDER" | "INTERPRETER";
  };
};

/**
 * Server-side RBAC guard.
 * Use in Server Components and Server Actions to enforce role access.
 *
 * @example
 *   const session = await requireRole("ADMIN", "HOLDER");
 *   // session.user.role is guaranteed to be ADMIN or HOLDER
 */
export async function requireRole(...roles: string[]): Promise<RbacSession> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user || !role || !roles.includes(role)) {
    throw new Error(`Unauthorized: requires one of [${roles.join(", ")}]`);
  }

  return {
    user: {
      id: session.user.id!,
      email: session.user.email!,
      name: session.user.name!,
      role: role as RbacSession["user"]["role"],
    },
  };
}
