import { createClient } from './supabase/server';
import prisma from './prisma';

/**
 * AUTH BRIDGE
 * Temporary wrapper to support legacy auth() calls using Supabase Auth.
 * This prevents breaking existing pages while we migrate to native Supabase patterns.
 */
export async function auth() {
  const supabase = await createClient();
  let user: any = null;
  try {
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
  } catch {
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
