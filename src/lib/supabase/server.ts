import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
