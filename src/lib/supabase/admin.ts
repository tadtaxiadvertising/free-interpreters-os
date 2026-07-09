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

let _serviceKeyWarningLogged = false;

export function getSupabaseServiceRoleKey() {
  const value1 = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (value1) return value1;

  const value2 = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (value2) return value2;

  // Also check globalThis just in case it's in a weird context
  if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.SUPABASE_SERVICE_ROLE_KEY) {
     return (globalThis as any).process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  }

  // Log once per process so we can diagnose auth failures in Easypanel
  if (!_serviceKeyWarningLogged) {
    _serviceKeyWarningLogged = true;
    console.warn(
      '⚠️ [SUPABASE_ADMIN] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Admin operations will be unavailable.'
    );
  }

  return '';
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
