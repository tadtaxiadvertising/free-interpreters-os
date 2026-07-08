'use client';

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_BROWSER_CONFIG_ERROR = 'SUPABASE_BROWSER_CONFIG_MISSING';

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(SUPABASE_BROWSER_CONFIG_ERROR);
  }

  return { url, key };
}

export function isSupabaseBrowserConfigError(error: unknown): boolean {
  return error instanceof Error && error.message === SUPABASE_BROWSER_CONFIG_ERROR;
}

export function createClient() {
  const { url, key } = getSupabaseBrowserConfig();

  return createBrowserClient(
    url,
    key,
    {
      realtime: {
        timeout: 30000,
        params: {
          eventsPerSecond: 10,
        }
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: { 'x-application-name': 'free-interpreters-os' },
      }
    }
  );
}
