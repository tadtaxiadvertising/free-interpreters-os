import { createClient, isSupabaseConfigError } from './supabase/server';
import prisma from './prisma';

/**
 * AUTH BRIDGE
 * Temporary wrapper to support legacy auth() calls using Supabase Auth.
 * This prevents breaking existing pages while we migrate to native Supabase patterns.
 */
export async function auth() {
  let user: any = null;

  try {
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (currentUser) {
      const profile = await prisma.userProfile.findUnique({
        where: { id: currentUser.id },
        select: { role: true, displayName: true }
      });
      user = {
        ...currentUser,
        role: profile?.role || 'interpreter',
        displayName: profile?.displayName || currentUser.email?.split('@')[0]
      };
    }
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      console.warn(
        '⚠️ [AUTH_BRIDGE] Supabase configuration is missing; returning an anonymous session.'
      );
    } else {
      console.warn(
        '⚠️ [AUTH_BRIDGE] Unable to resolve Supabase session; returning an anonymous session:',
        error instanceof Error ? error.message : error
      );
    }
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
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    if (isSupabaseConfigError(error)) {
      console.warn('⚠️ [AUTH_BRIDGE] Supabase configuration is missing; sign out skipped.');
      return;
    }
    throw error;
  }
}
