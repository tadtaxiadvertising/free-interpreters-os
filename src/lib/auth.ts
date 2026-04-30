import { createClient } from './supabase/server';

/**
 * AUTH BRIDGE
 * Temporary wrapper to support legacy auth() calls using Supabase Auth.
 * This prevents breaking existing pages while we migrate to native Supabase patterns.
 */
export async function auth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return { 
    userId: user?.id || null 
  };
}

// Legacy session functions (no-op as Supabase handles this)
export async function getSession() {
  const { userId } = await auth();
  if (!userId) return null;
  return { userId };
}

export async function destroySession() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
