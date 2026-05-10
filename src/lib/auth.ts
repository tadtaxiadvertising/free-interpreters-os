import { createClient } from './supabase/server';

/**
 * AUTH BRIDGE
 * Temporary wrapper to support legacy auth() calls using Supabase Auth.
 * This prevents breaking existing pages while we migrate to native Supabase patterns.
 */
export async function auth() {
  const supabase = await createClient();
  let user = null;
  try {
    console.log('--- [AUTH_BRIDGE] Calling getUser()...');
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log('--- [AUTH_BRIDGE] getUser() finished. User found:', !!currentUser);
    user = currentUser;
  } catch (e) {
    // Ignore auth errors for the bridge
  }
  
  return { 
    userId: user?.id || null,
    user: user
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
