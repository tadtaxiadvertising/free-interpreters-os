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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      displayName: true,
      email: true
    }
  });

  return {
    ...user,
    profile
  };
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
