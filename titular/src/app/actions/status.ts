'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ActionResult, RealtimeStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const db = prisma;

export async function updateInterpreterStatus(
  newStatus: RealtimeStatus
): Promise<ActionResult<{ status: RealtimeStatus }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // 1. Get the interpreter ID linked to this user via Prisma
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: false, error: 'No interpreter linked to this account', code: 'NOT_FOUND' };
    }

    // 2. Update the status in the interpreters table via Prisma
    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: { realtimeStatus: newStatus },
      select: { id: true }
    });

    revalidatePath('/dashboard');
    return { success: true, data: { status: newStatus } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error updating status:', message);
    return { success: false, error: message, code: 'SERVICE_UNAVAILABLE' };
  }
}

