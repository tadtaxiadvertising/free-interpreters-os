'use server';

import { ActionResult, UserRole } from '@/lib/types';
import { getCurrentActor, requireActor, requireRole, CurrentActor } from './current-actor';
import { resolveCurrentIdentity, ResolvedIdentity } from '@/lib/identity/resolve-user';

/**
 * CACHED AUTH HELPER — DELEGATES TO CurrentActor ABSTRACTION
 * ============================================================
 * Returns a simplified user object for backward compatibility.
 * Now uses the new Identity Resolver as the single source of truth.
 * ============================================================
 */
export const getCurrentUser = async () => {
  const identity = await resolveCurrentIdentity();
  if (!identity) return null;

  return {
    id: identity.userId,
    email: identity.email,
    profile: {
      id: identity.profileId,
      role: identity.role,
      displayName: null,
      email: identity.email,
      interpreterId: identity.interpreterId,
    },
  };
};

/**
 * NEW: Get full resolved identity with onboarding and roleplay state
 * ============================================================
 * This is the new canonical way to get user state.
 * ============================================================
 */
export const getResolvedIdentity = async (): Promise<ResolvedIdentity | null> => {
  return await resolveCurrentIdentity();
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

/**
 * NEW: Validate action with full identity resolution
 * ============================================================
 * Returns the ResolvedIdentity with onboarding/roleplay state
 * ============================================================
 */
export async function validateActionWithIdentity(requiredRole?: UserRole | UserRole[]): Promise<{
  identity: ResolvedIdentity;
} | { error: string; code: NonNullable<ActionResult['code']> }> {
  const identity = await resolveCurrentIdentity();

  if (!identity) {
    return { error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(identity.role)) {
      return { error: 'Access denied: insufficient permissions', code: 'UNAUTHORIZED' };
    }
  }

  return { identity };
}