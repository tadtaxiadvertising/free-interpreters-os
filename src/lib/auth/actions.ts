import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { ActionResult, UserRole } from '@/lib/types';
import { cache } from 'react';

/**
 * CACHED AUTH HELPER
 * ============================================================
 * Deduplicates authentication calls within the same request.
 * ============================================================
 */
export const getCurrentUser = cache(async () => {
  let supabaseUser = null;
  let supabaseProfile = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      supabaseUser = user;
      supabaseProfile = await prisma.userProfile.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          role: true,
          displayName: true,
          email: true,
          interpreterId: true
        }
      });
    }
  } catch (error) {
    // Supabase variables might be missing in RBAC-only environments (e.g. interpreters subproject)
    // We catch it here to allow clean fallback to Auth.js credentials session
  }
  
  if (supabaseUser) {
    return {
      ...supabaseUser,
      profile: supabaseProfile
    };
  }
  
  return null;
});

/**
 * SERVER ACTION GUARD
 * ============================================================
 * Standardizes authentication and role checks for server actions.
 * ============================================================
 */
export async function validateAction(requiredRole?: UserRole | UserRole[]): Promise<{
  user: any;
  profile: any;
} | { error: string; code: NonNullable<ActionResult['code']> }> {
  const userData = await getCurrentUser();
  
  if (!userData) {
    return { error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = (userData.profile?.role || 'interpreter').toLowerCase() as UserRole;
    
    if (!roles.includes(userRole)) {
      return { error: 'Access denied: insufficient permissions', code: 'UNAUTHORIZED' };
    }
  }

  return {
    user: userData,
    profile: userData.profile
  };
}
