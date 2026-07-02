import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

// Force Auth.js to trust the proxy host (Easypanel/Vercel)
process.env.AUTH_TRUST_HOST = "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET || "fallback-secret-for-interpreters-os",
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      async authorize(credentials: unknown) {
        const { email, password } = z
          .object({ email: z.string().email(), password: z.string() })
          .parse(credentials);
        
        const user = await prisma.rbacUser.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
          throw new Error("Invalid credentials");
        }
        
        return { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          name: user.name 
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) token.role = user.role;
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
}) as any;
