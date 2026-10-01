import { ActionResult, UserRole } from '@/lib/types';
import { getCurrentActor, requireActor, requireRole, CurrentActor } from './current-actor';

/**
 * CACHED AUTH HELPER — DELEGATES TO CurrentActor ABSTRACTION
 * ============================================================
 * Returns a simplified user object for backward compatibility.
 * ============================================================
 */
export const getCurrentUser = async () => {
  const actor = await getCurrentActor();
  if (!actor) return null;

  return {
    id: actor.userId,
    email: actor.email,
    profile: {
      id: actor.profileId,
      role: actor.role,
      displayName: null,
      email: actor.email,
      interpreterId: actor.interpreterId,
    },
  };
};

/**
 * SERVER ACTION GUARD — USES CurrentActor ABSTRACTION
 * ============================================================
 * Standardizes authentication and role checks for server actions.
 * ============================================================
 */
export async function validateAction(requiredRole?: UserRole | UserRole[]): Promise<{
  user: CurrentActor;
  profile: CurrentActor;
} | { error: string; code: NonNullable<ActionResult['code']> }> {
  const actor = await getCurrentActor();

  if (!actor) {
    return { error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(actor.role)) {
      return { error: 'Access denied: insufficient permissions', code: 'UNAUTHORIZED' };
    }
  }

  return {
    user: actor,
    profile: actor,
  };
}