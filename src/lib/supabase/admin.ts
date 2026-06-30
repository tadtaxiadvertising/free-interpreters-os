import { createClient } from '@supabase/supabase-js';

// Load environment variables if they are not already set (e.g. running in standalone Next.js server locally).
// Uses dynamic require() to avoid Edge Runtime warnings since this file is imported by middleware.ts.
if (typeof window === 'undefined' && typeof (globalThis as any).EdgeRuntime === 'undefined') {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const getCwd = () => (process as any)['cwd']();
    dotenv.config({ path: path.resolve(getCwd(), '.env.local') });
    dotenv.config({ path: path.resolve(getCwd(), '.env') });
  } catch {
    // dotenv may not be available in production standalone builds — that's fine,
    // env vars are injected by Easypanel at runtime.
  }
}

const SERVICE_ROLE_ENV_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'] as const;

export function getSupabaseServiceRoleKey() {
  for (const envName of SERVICE_ROLE_ENV_NAMES) {
    const value = process.env[envName]?.trim();
    if (value) return value;
  }

  return '';
}

export function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set in environment variables.');
  }

  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set in environment variables. ' +
      'This is required for admin operations like creating users. ' +
      'Set it to the Supabase service_role secret key in your server runtime environment.'
    );
  }

  return { url, serviceRoleKey };
}

export function createAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig();

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
