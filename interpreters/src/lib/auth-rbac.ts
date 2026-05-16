import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

/**
 * RBAC Auth Configuration — Unified Login
 * Single entry point; JWT embeds role for server-side route protection.
 * Compatible with NextAuth v5 (Auth.js) beta.
 */

const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        let email, password;
        try {
          const parsed = LoginSchema.parse(credentials);
          email = parsed.email.toLowerCase().trim();
          password = parsed.password;

          console.log(`[AUTH] Authorize attempt for: ${email}`);
        } catch (err) {
          console.log(`[AUTH] Validation error for input credentials`);
          return null;
        }

        let user;
        try {
          // Use findFirst with mode: 'insensitive' to handle potential DB case mismatches
          user = await prisma.rbacUser.findFirst({
            where: { 
              email: {
                equals: email,
                mode: 'insensitive'
              }
            },
          });

          if (!user) {
            console.warn(`[AUTH] User not found in database: ${email}`);
            return null;
          }
          
          console.log(`[AUTH] User found: ${user.email} (ID: ${user.id})`);
        } catch (dbError) {
          console.error(`[AUTH] Database connection error during lookup for ${email}:`, dbError);
          throw new Error("Database connection error");
        }

        let isPasswordValid = false;
        try {
          isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            console.warn(`[AUTH] Password mismatch for user: ${email}`);
            return null;
          }
        } catch (compareError) {
          console.error(`[AUTH] bcrypt comparison error for ${email}:`, compareError);
          throw new Error("Password comparison error");
        }

        console.log(`[AUTH] Authentication successful for: ${email}`);

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
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      
      // En cada refresh de sesión, aseguramos de sacar el rol de la base de datos
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

// ── Type augmentation ──
export type RbacSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "ADMIN" | "HOLDER" | "INTERPRETER";
  };
};

/**
 * Server-side RBAC guard. Throws on unauthorized access.
 */
export async function requireRole(...roles: string[]) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (!session?.user || !role || !roles.includes(role)) {
    throw new Error(`Unauthorized: requires ${roles.join(" | ")}`);
  }
  return { ...session, user: { ...session.user, role, id: session.user.id } } as unknown as RbacSession;
}
