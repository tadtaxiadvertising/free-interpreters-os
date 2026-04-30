'use server';

import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import type { ActionResult, RealtimeStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function updateInterpreterStatus(
  newStatus: RealtimeStatus
): Promise<ActionResult<{ status: RealtimeStatus }>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await (prisma as any).userProfile.findFirst({
      where: { 
        OR: [
          { id: userId },
          { clerkId: userId }
        ]
      },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
    }

    await (prisma as any).interpreter.update({
      where: { id: profile.interpreterId },
      data: { realtimeStatus: newStatus }
    });

    revalidatePath('/dashboard');
    return { success: true, data: { status: newStatus } };
  } catch (error: any) {
    console.error('Error updating status:', error);
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}
