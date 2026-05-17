import { z } from "zod";

/**
 * RUNTIME ENVIRONMENT VALIDATION — Zod
 * ============================================================
 * DESIGN DECISIONS:
 *   1. GRACEFUL DEGRADATION: If validation fails, the process
 *      logs detailed diagnostics but does NOT throw. This keeps
 *      the container alive long enough for the health check to
 *      respond with "degraded" status, preventing Easypanel from
 *      entering a SIGTERM restart loop.
 *   2. COMPLETE COVERAGE: Validates all variables required by
 *      both auth systems (Supabase Auth + Auth.js) and the Vault
 *      encryption engine. Missing any of these causes silent
 *      failures that are extremely hard to debug in production.
 *   3. BUILD-TIME vs RUNTIME: NEXT_PUBLIC_* vars are inlined at
 *      build time by Next.js. They appear here for completeness
 *      but their absence only affects client-side code.
 * ============================================================
 */

const envSchema = z.object({
  // ── Supabase (Dashboard Auth) ──────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // ── External API ───────────────────────────────────────────
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // ── Database (Prisma + pg Pool) ────────────────────────────
  DATABASE_URL: z
    .string()
    .startsWith("postgresql://", "DATABASE_URL must start with postgresql://")
    .optional(),
  DIRECT_URL: z
    .string()
    .startsWith("postgresql://", "DIRECT_URL must start with postgresql://")
    .optional(),

  // ── Auth.js (RBAC Portal) ─────────────────────────────────
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters for secure JWT signing")
    .optional(),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),

  // ── Vault Encryption ──────────────────────────────────────
  ENCRYPTION_KEY: z.string().min(16, "ENCRYPTION_KEY is too short").optional(),

  // ── Runtime ────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Tracks whether the environment is fully validated.
 * Components can check `envHealthy` to render degraded UI
 * instead of crashing on missing configuration.
 */
export let envHealthy = true;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    envHealthy = false;
    console.error(
      "══════════════════════════════════════════════════════════════"
    );
    console.error("⚠️  ENVIRONMENT VALIDATION FAILED — DEGRADED MODE ACTIVE");
    console.error(
      "══════════════════════════════════════════════════════════════"
    );
    console.error(
      "The following environment variables are missing or invalid:"
    );
    console.error(
      JSON.stringify(result.error.flatten().fieldErrors, null, 2)
    );
    console.error(
      "The application will continue running in DEGRADED mode."
    );
    console.error(
      "Features that depend on missing variables will fail gracefully."
    );
    console.error(
      "══════════════════════════════════════════════════════════════"
    );

    // Return a partial env with whatever parsed successfully + defaults.
    // This prevents the Node.js process from crashing during container boot.
    return {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      NODE_ENV:
        (process.env.NODE_ENV as "development" | "production" | "test") ??
        "production",
    } as Env;
  }

  console.log("[ENV] ✅ All environment variables validated successfully.");
  return result.data;
}

export const env = validateEnv();
