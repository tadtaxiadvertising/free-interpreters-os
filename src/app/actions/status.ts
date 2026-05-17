'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ActionResult, RealtimeStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

export async function updateInterpreterStatus(
  newStatus: RealtimeStatus
): Promise<ActionResult<{ status: RealtimeStatus }>> {
  const auth = await validateAction('interpreter');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const profile = auth.profile;
    if (!profile.interpreterId) {
      return { success: false, error: 'No interpreter linked to this account', code: 'NOT_FOUND' };
    }

    // Update the status in the interpreters table via Prisma
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
    return { success: false, error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' };
  }
}

