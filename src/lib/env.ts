import { z } from "zod";

/**
 * STRICT ENVIRONMENT VALIDATION
 * Reconfigured for Vercel + Supabase ($0)
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  DATABASE_URL: z.string().startsWith("postgresql://").optional(),
  DIRECT_URL: z.string().startsWith("postgresql://").optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ CRITICAL: Invalid environment variables:");
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    throw new Error("Infrastructure misconfiguration detected.");
  }

  return result.data;
}

export const env = validateEnv();
