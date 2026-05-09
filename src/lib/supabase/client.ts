'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
