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
        const { email, password } = LoginSchema.parse(credentials);

        const user = await (prisma as any).rbacUser.findUnique({
          where: { email },
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
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
  const role = (session?.user as any)?.role;
  if (!session?.user || !roles.includes(role)) {
    throw new Error(`Unauthorized: requires ${roles.join(" | ")}`);
  }
  return { ...session, user: { ...session.user, role, id: (session.user as any).id } } as unknown as RbacSession;
}
