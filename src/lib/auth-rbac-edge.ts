import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
 
 // Force trust host for production proxy environments
 process.env.AUTH_TRUST_HOST = "true";


/**
 * Edge-compatible NextAuth instance for Middleware.
 * This file MUST NOT import prisma or any other Node.js-only modules.
 */
export const { auth } = NextAuth({
  ...authConfig,
  trustHost: true,
});
