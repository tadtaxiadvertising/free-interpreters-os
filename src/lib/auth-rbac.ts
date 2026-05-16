import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
 
 // Force trust host for production proxy environments
 process.env.AUTH_TRUST_HOST = "true";


/**
 * RBAC Auth Configuration — Server-only (Node.js Runtime)
 * ============================================================
 * Extends the Edge-compatible authConfig with:
 *   - Credentials provider (email + password login)
 *   - Prisma database lookups for user verification
 *   - JWT callbacks with role embedding
 *
 * LEAN QUERY RULES:
 *   - ALWAYS use `select` to pick only needed fields.
 *   - NEVER use `findUnique()` without `select`.
 *   - The JWT refresh callback fetches ONLY `role` (1 column).
 *
 * SESSION FLOW:
 *   1. User submits credentials → authorize() validates
 *   2. JWT token created with { id, email, name, role }
 *   3. On every request, jwt() callback refreshes role from DB
 *   4. session() callback exposes id + role to client
 * ============================================================
 */

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        let email, password;
        try {
          const parsed = LoginSchema.parse(credentials);
          email = parsed.email.toLowerCase().trim(); // Normalize email to prevent case-sensitivity issues
          password = parsed.password;
        } catch (err) {
          console.log(`[AUTH] Validation error for input credentials`);
          return null;
        }

        let user;
        try {
          // LEAN QUERY: Only select fields needed for auth
          user = await prisma.rbacUser.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              password: true,
            },
          });
        } catch (dbError) {
          // Explicitly catch DB connection issues to prevent masking as "Invalid credentials"
          console.error(`[AUTH] Database connection error during lookup for ${email}:`, dbError);
          throw new Error("Database connection error");
        }

        let isPasswordValid = false;
        try {
          if (user) {
            isPasswordValid = await bcrypt.compare(password, user.password);
          }
        } catch (compareError) {
          console.error(`[AUTH] bcrypt comparison error for ${email}:`, compareError);
          throw new Error("Password comparison error");
        }

        if (!user || !isPasswordValid) {
          console.log(`[AUTH] Invalid credentials attempt for: ${email}`);
          return null;
        }

        // Return user object (password excluded from token)
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
      // Initial sign-in: embed role from authorize() return
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }

      // On every token refresh: re-fetch role from DB (lean: 1 column)
      // This ensures role changes take effect without re-login.
      if (token.id) {
        const dbUser = await prisma.rbacUser.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
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
  },
});

// ── Type Augmentation ─────────────────────────────────────
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
 * Throws on unauthorized access — callers should catch and return 403.
 */
export async function requireRole(...roles: string[]): Promise<RbacSession> {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (!session?.user || !role || !roles.includes(role)) {
    throw new Error(`Unauthorized: requires ${roles.join(" | ")}`);
  }

  return {
    user: {
      ...session.user,
      role,
      id: session.user.id,
    },
  } as unknown as RbacSession;
}
