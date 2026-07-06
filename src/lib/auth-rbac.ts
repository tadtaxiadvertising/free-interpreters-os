import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Dotenv fallback — load .env.local / .env when running standalone server
// (Identical pattern to server.ts and admin.ts)
// ---------------------------------------------------------------------------
if (typeof window === 'undefined' && typeof (globalThis as any).EdgeRuntime === 'undefined') {
  try {
    const dotenv = require('dotenv');
    const fs = require('fs');
    const path = require('path');
    const getCwd = () => (process as any)['cwd']();

    const loadEnv = (file: string) => {
      try {
        const fullPath = path.resolve(getCwd(), file);
        if (fs.existsSync(fullPath)) {
          const parsed = dotenv.parse(fs.readFileSync(fullPath));
          for (const k in parsed) {
            if (!process.env[k]) process.env[k] = parsed[k];
          }
        }
      } catch (e) {}
    };

    loadEnv('.env.local');
    loadEnv('.env');
  } catch {
    // silently ignore — dotenv may not be available in Edge
  }
}

// Force Auth.js to trust the proxy host (Easypanel/Vercel)
process.env.AUTH_TRUST_HOST = "true";

// ---------------------------------------------------------------------------
// AUTH_SECRET resolution — hardened fallback
// Priority: AUTH_SECRET env → derived from ENCRYPTION_KEY → stable dev default
// ---------------------------------------------------------------------------
if (!process.env.AUTH_SECRET) {
  if (process.env.ENCRYPTION_KEY) {
    // Derive a stable 32-byte secret from the existing ENCRYPTION_KEY
    process.env.AUTH_SECRET = crypto
      .createHash('sha256')
      .update(process.env.ENCRYPTION_KEY)
      .digest('hex')
      .slice(0, 32);
    console.warn(
      '[AUTH-RBAC] AUTH_SECRET was missing — derived from ENCRYPTION_KEY. ' +
      'Set AUTH_SECRET explicitly in production for best security.'
    );
  } else {
    console.error(
      "[AUTH-RBAC] FATAL: Neither AUTH_SECRET nor ENCRYPTION_KEY is set. " +
      "NextAuth sessions will fail. Set AUTH_SECRET in your environment."
    );
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      credentials: { email: {}, password: {} },
      async authorize(credentials: unknown) {
        const { email, password } = z
          .object({ email: z.string().email().toLowerCase().trim(), password: z.string() })
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
