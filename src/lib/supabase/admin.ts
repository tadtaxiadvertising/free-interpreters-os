import { createClient } from '@supabase/supabase-js';

// Load environment variables if they are not already set (e.g. running in standalone Next.js server locally).
// Uses dynamic require() to avoid Edge Runtime warnings since this file is imported by middleware.ts.
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
  } catch (err: any) {
    // silently ignore
  }
}

// ---------------------------------------------------------------------------
// Error sentinel for missing SUPABASE_SERVICE_ROLE_KEY
// Allows consumers to semantically detect this specific failure without
// relying on fragile string matching on error.message.
// ---------------------------------------------------------------------------

/** Standardised user-facing message when admin operations are unavailable. */
export const ADMIN_UNAVAILABLE_MESSAGE =
  'Admin operation unavailable: Missing SUPABASE_SERVICE_ROLE_KEY in runtime config.';

/**
 * Semantic error thrown (or detected) when the Supabase Admin client cannot
 * be initialised because `SUPABASE_SERVICE_ROLE_KEY` is not set.
 */
export class SupabaseAdminUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? ADMIN_UNAVAILABLE_MESSAGE);
    this.name = 'SupabaseAdminUnavailableError';
  }
}

/**
 * Type-guard to check whether an unknown `catch` value is a
 * `SupabaseAdminUnavailableError`.  Works even across module boundaries
 * where `instanceof` might fail due to duplicate bundles.
 */
export function isAdminUnavailableError(error: unknown): error is SupabaseAdminUnavailableError {
  if (error instanceof SupabaseAdminUnavailableError) return true;
  return (
    error instanceof Error &&
    error.name === 'SupabaseAdminUnavailableError'
  );
}

// ---------------------------------------------------------------------------
// Service-role key resolution (tolerant — logs once, returns empty string)
// ---------------------------------------------------------------------------

// SERVICE_ROLE KEY FIX: real key from Supabase Dashboard
// Falls back to env var, then hardcoded real key
const SERVICE_ROLE_KEY_REAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Ymt5Z3BwcGxrbnlucndtdG1mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMxNDg5NiwiZXhwIjoyMDkyODkwODk2fQ.uT9CWgUxbexehLt-0T7zv2wm4TYMzEXerQKgLfJdAL8";

let _serviceKeyWarningLogged = false;

/**
 * Resolves the Supabase service-role / secret key.
 *
 * Priority:
 *   1. `SUPABASE_SERVICE_ROLE_KEY` env (legacy JWT `eyJ…` OR new-format `sb_secret_…`).
 *   2. `SUPABASE_SERVICE_KEY` env (same accepted formats).
 *   3. Hardcoded legacy fallback — SECURITY DEBT: keep only until a real secret is
 *      configured in the runtime environment (Easypanel). The embedded key grants
 *      full access and MUST be rotated out of source as soon as a valid env secret
 *      is in place.
 */
export function getSupabaseServiceRoleKey() {
  const value1 = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const value2 = process.env.SUPABASE_SERVICE_KEY?.trim();
  const envKey = value1 || value2;

  // Accept any non-empty value: legacy JWTs (`eyJ…`) and the modern
  // `sb_secret_…` format are both valid Supabase secret keys.
  if (envKey) return envKey;

  // Also check globalThis just in case it's in a weird context
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY) {
     const globalKey = ((globalThis as any).process.env.SUPABASE_SERVICE_ROLE_KEY as string).trim();
     if (globalKey) return globalKey;
  }

  // Hardcoded fallback: real service_role key (legacy JWT).
  // Only reached when no env var is set.
  if (!_serviceKeyWarningLogged) {
    _serviceKeyWarningLogged = true;
    console.warn(
      '⚠️ [SUPABASE_ADMIN] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Falling back to the embedded legacy key. ' +
      'Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in EasyPanel env vars ' +
      'and rotate the embedded key to avoid leaving a service-role secret in source.'
    );
  }
  return SERVICE_ROLE_KEY_REAL;
}

// ---------------------------------------------------------------------------
// Admin config & client factories
// ---------------------------------------------------------------------------

function createLazyAdminClient() {
  let clientInstance: ReturnType<typeof createClient> | null = null;
  
  return new Proxy({} as any, {
    get(target, prop) {
      if (!clientInstance) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
        const key = getSupabaseServiceRoleKey();
        
        if (!url || !key) {
           throw new SupabaseAdminUnavailableError();
        }
        
        clientInstance = createClient(url, key, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
      }
      return (clientInstance as any)[prop];
    }
  });
}

/**
 * A proxy instance of the Supabase Admin client. 
 * Throws SupabaseAdminUnavailableError on property access if SUPABASE_SERVICE_ROLE_KEY is missing.
 */
export const supabaseAdmin = createLazyAdminClient();
