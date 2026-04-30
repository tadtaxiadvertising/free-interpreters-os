import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import type { UserProfile } from '@/lib/types';
import { redirect } from 'next/navigation';

/**
 * Gets the current database profile for the authenticated Clerk user
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const { userId } = await auth();
  
  if (!userId) return null;

  const profile = await prisma.userProfile.findFirst({
    where: { 
      OR: [
        { id: userId }, // If we store clerk_id in the ID field
        // @ts-ignore - Assuming we added clerk_id to the schema or using ID
        { clerkId: userId } 
      ]
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      interpreterId: true,
      createdAt: true
    }
  });

  if (!profile) return null;

  return {
    id: profile.id,
    role: profile.role as any,
    interpreter_id: profile.interpreterId,
    display_name: profile.displayName || '',
    created_at: profile.createdAt.toISOString()
  };
}

export async function logout() {
  // Clerk handles logout via its own components/hooks usually, 
  // but if we need a server-side redirect:
  redirect('/');
}
