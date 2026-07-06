import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { ActionResult, UserRole } from '@/lib/types';
import { cache } from 'react';
import { auth } from '@/lib/auth-rbac';

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

      // Self-healing: if the user exists in Supabase but has no userProfile record in the public schema
      if (!supabaseProfile && user.email) {
        console.log(`🔧 [AUTH] Self-healing profile auto-creation for user: ${user.email}`);

        // Determine default role based on email matches
        const emailLower = user.email.toLowerCase();
        let role = 'interpreter';
        if (
          emailLower === 'interpretersfree@gmail.com' ||
          emailLower === 'melvinramonduranmesa@gmail.com' ||
          emailLower === 'admin@freeinterpreters.com' ||
          emailLower.includes('admin')
        ) {
          role = 'admin';
        }

        // Link with an interpreter profile — broader matching (email or name)
        const interpreter = await prisma.interpreter.findFirst({
          where: {
            OR: [
              { emailCorporativo: user.email },
              { name: user.user_metadata?.display_name || user.email?.split('@')[0] },
            ],
          },
          select: { id: true }
        });

        // Safe creation of the profile
        supabaseProfile = await prisma.userProfile.create({
          data: {
            id: user.id,
            email: user.email,
            displayName: user.user_metadata?.display_name || user.email.split('@')[0],
            role: role,
            interpreterId: interpreter?.id || null
          },
          select: {
            id: true,
            role: true,
            displayName: true,
            email: true,
            interpreterId: true
          }
        });
      }

      // Self-healing: link interpreter when profile exists but interpreterId is null
      if (supabaseProfile && !supabaseProfile.interpreterId && supabaseUser?.email) {
        try {
          const interpreterMatch = await prisma.interpreter.findFirst({
            where: {
              OR: [
                { emailCorporativo: supabaseUser.email },
                { name: supabaseProfile.displayName || supabaseUser.email?.split('@')[0] },
              ],
            },
            select: { id: true },
          });

          if (interpreterMatch) {
            await prisma.userProfile.update({
              where: { id: supabaseProfile.id },
              data: { interpreterId: interpreterMatch.id },
            });
            supabaseProfile = { ...supabaseProfile, interpreterId: interpreterMatch.id };
            console.log(`🔧 [AUTH] Interpreter link auto-repaired for ${supabaseProfile.id} → interpreter ${interpreterMatch.id}`);
          }
        } catch (linkErr) {
          console.error('[AUTH] Interpreter link repair failed:', linkErr);
        }
      }
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

  // Fallback to NextAuth (Auth.js) session
  try {
    const session = await auth();
    if (session?.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        profile: {
          id: session.user.id,
          role: (session.user as any).role || 'interpreter',
          displayName: session.user.name,
          email: session.user.email,
          interpreterId: (session.user as any).interpreterId || null,
        }
      };
    }
  } catch (authError) {
    console.error('NextAuth Fallback Error:', authError);
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
