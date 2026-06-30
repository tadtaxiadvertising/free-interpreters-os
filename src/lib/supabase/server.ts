import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Load environment variables if they are not already set (e.g. running in standalone Next.js server locally).
// Uses dynamic require() to avoid Edge Runtime warnings.
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

const SUPABASE_CONFIG_ERROR = 'SUPABASE_CONFIG_MISSING';

function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }

  return { url, key };
}

export function isSupabaseConfigError(error: unknown): boolean {
  return error instanceof Error && error.message === SUPABASE_CONFIG_ERROR;
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabasePublicConfig();

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Can be ignored in Server Components (read-only context)
          }
        },
      },
    }
  );
}
