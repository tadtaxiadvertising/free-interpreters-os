'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(`Your project's URL and Key are required! (URL: ${url ? 'set' : 'missing'}, Key: ${key ? 'set' : 'missing'})`);
  }

  return createBrowserClient(
    url,
    key,
    {
      // Aggressive Realtime Disabling to stop 'Presence API Error'
      realtime: {
        timeout: 1, // Minimize timeout to fail fast if triggered
        params: {
          eventsPerSecond: 0,
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
