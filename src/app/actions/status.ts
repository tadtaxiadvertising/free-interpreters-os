'use server';

import prisma from '@/lib/prisma';
import type { ActionResult, RealtimeStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

/**
 * ACTION: Update interpreter realtime status
 * 
 * Updates the interpreter's status in DB and logs the change.
 */
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

    const interpreterId = profile.interpreterId;
    const now = new Date();

    // Get current status to log the transition
    const current = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { realtimeStatus: true },
    });
    const previousStatus = current?.realtimeStatus || 'Offline';

    // Update status + timestamps in a transaction with audit log
    await db.$transaction([
      db.interpreter.update({
        where: { id: interpreterId },
        data: {
          realtimeStatus: newStatus,
          statusReason: 'manual',
          statusChangedAt: now,
          lastActivity: now,
          ...(newStatus === 'Online' ? { lastOnlineAt: now } : {}),
          ...(newStatus === 'Offline' ? { lastOfflineAt: now } : {}),
        },
        select: { id: true },
      }),
      db.interpreterStatusLog.create({
        data: {
          interpreterId,
          previousStatus,
          newStatus,
          reason: 'manual',
          changedBy: 'interpreter',
          metadata: { source: 'updateInterpreterStatus action' },
        },
      }),
    ]);

    revalidatePath('/dashboard');
    return { success: true, data: { status: newStatus } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error updating status:', message);
    return { success: false, error: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' };
  }
}