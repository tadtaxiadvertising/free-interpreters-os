import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Edge-compatible NextAuth instance for Middleware.
 * ============================================================
 * This file MUST NOT import prisma, pg, bcryptjs, or any other
 * Node.js-only modules. It uses the Edge-safe authConfig subset
 * which contains only JWT callbacks and page definitions.
 *
 * The full auth configuration (with CredentialsProvider + DB lookups)
 * lives in ./auth-rbac.ts and runs exclusively on the Node.js runtime.
 * ============================================================
 */

if (typeof process !== "undefined") {
  process.env.AUTH_TRUST_HOST = "true";
}

export const { auth } = NextAuth({
  ...authConfig,
  trustHost: true,
});
