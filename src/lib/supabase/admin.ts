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
      'Admin operations (email confirm, user provisioning) will be unavailable. ' +
      'Set this env var in Easypanel runtime config.'
    );
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
