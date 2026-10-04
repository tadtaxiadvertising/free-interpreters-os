import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { cache } from 'react';
import { UserRole } from '@/lib/types';
import { auth } from '@/lib/auth-rbac';
import { resolveUserRoleByEmail } from '@/lib/admin-identity';

export type AuthProvider = 'supabase' | 'authjs';

export type CurrentActor = {
  provider: AuthProvider;
  userId: string;
  email: string | null;
  role: UserRole;
  interpreterId: number | null;
  profileId: string | null;
};

function normalizeRbacRole(role: string | null | undefined): UserRole {
  return role?.toLowerCase() === 'admin' ? 'admin' : 'interpreter';
}

async function resolveActorFromSupabase(
  supabaseUser: { id: string; email?: string | null; user_metadata?: { display_name?: string } }
): Promise<CurrentActor | null> {
  const userId = supabaseUser.id;
  const email = supabaseUser.email?.toLowerCase().trim() || null;

  if (!email) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { id: true, role: true, interpreterId: true, email: true },
  });

  let resolvedRole: UserRole = 'interpreter';
  let interpreterId: number | null = profile?.interpreterId ?? null;

  if (profile) {
    resolvedRole = resolveUserRoleByEmail(profile.email, profile.role);
    interpreterId = resolvedRole === 'admin' ? null : (profile.interpreterId ?? null);
  } else {
    resolvedRole = resolveUserRoleByEmail(email, 'interpreter');
  }

  if (resolvedRole !== 'admin' && !interpreterId) {
    const interpreter = await prisma.interpreter.findFirst({
      where: {
        OR: [
          { emailCorporativo: email },
          { name: supabaseUser.user_metadata?.display_name || email.split('@')[0] },
        ],
      },
      select: { id: true },
    });
    interpreterId = interpreter?.id ?? null;
  }

  return {
    provider: 'supabase',
    userId,
    email,
    role: resolvedRole,
    interpreterId,
    profileId: profile?.id ?? null,
  };
}

async function resolveActorFromAuthJs(): Promise<CurrentActor | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) return null;

    const userId = session.user.id;
    const email = session.user.email?.toLowerCase().trim() || null;
    const role = normalizeRbacRole((session.user as any).role);

    if (!email) return null;

    // Auth.js credentials use RbacUser.id, while UserProfile is keyed by the
    // Supabase UUID. For this legacy bridge, resolve the profile by its unique
    // normalized email. The authenticated RbacUser remains the authority for
    // role/identity; this lookup only locates the user's application profile.
    const profile = await prisma.userProfile.findUnique({
      where: { email },
      select: { id: true, interpreterId: true },
    });

    let interpreterId = profile?.interpreterId ?? null;
    if (role !== 'admin' && !interpreterId) {
      const interpreter = await prisma.interpreter.findFirst({
        where: { emailCorporativo: email },
        select: { id: true },
      });
      interpreterId = interpreter?.id ?? null;
    }

    return {
      provider: 'authjs',
      userId,
      email,
      role,
      interpreterId: role === 'admin' ? null : interpreterId,
      profileId: profile?.id ?? null,
    };
  } catch {
    return null;
  }
}

export const getCurrentActor = cache(async (): Promise<CurrentActor | null> => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const actor = await resolveActorFromSupabase(user);
      if (actor) return actor;
    }
  } catch {
    // Supabase not configured, fall through to Auth.js
  }

  return await resolveActorFromAuthJs();
});

export function requireActor(actor: CurrentActor | null): CurrentActor {
  if (!actor) throw new Error('Not authenticated');
  return actor;
}

export function requireRole(actor: CurrentActor | null, requiredRoles: UserRole[]): CurrentActor {
  const a = requireActor(actor);
  if (!requiredRoles.includes(a.role)) throw new Error('Access denied: insufficient permissions');
  return a;
}

export function requireOwnership(actor: CurrentActor | null, resourceInterpreterId: number | null): CurrentActor {
  const a = requireActor(actor);
  if (a.role !== 'admin' && a.interpreterId !== resourceInterpreterId) {
    throw new Error('Access denied: not your resource');
  }
  return a;
}
