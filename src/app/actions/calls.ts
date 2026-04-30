'use server';

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { ActionResult, CallSession } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const db = prisma as any;

export async function startCall(): Promise<ActionResult<{ sessionId: number; startedAt: string }>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await db.userProfile.findFirst({
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

    // Check for existing active call
    const activeCall = await db.callSession.findFirst({
      where: {
        interpreterId: profile.interpreterId,
        endedAt: null
      }
    });

    if (activeCall) {
      return { success: false, error: 'A call is already active', code: 'CONFLICT' };
    }

    // Fetch current tariff
    const interpreter = await db.interpreter.findUnique({
      where: { id: profile.interpreterId },
      select: { tariffPerMinute: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter record not found', code: 'NOT_FOUND' };
    }

    // Create call session
    const session = await db.callSession.create({
      data: {
        interpreterId: profile.interpreterId,
        startedAt: new Date(),
        tariffSnapshot: interpreter.tariffPerMinute,
      }
    });

    // Auto-set status to Busy
    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: { realtimeStatus: 'Busy' }
    });

    revalidatePath('/dashboard');
    return {
      success: true,
      data: { sessionId: session.id, startedAt: session.startedAt.toISOString() },
    };
  } catch (error: any) {
    console.error('Error starting call:', error);
    return { success: false, error: 'Error starting call', code: 'INTERNAL_ERROR' };
  }
}

export async function endCall(
  sessionId: number
): Promise<ActionResult<{ durationSeconds: number; callCost: number }>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await db.userProfile.findFirst({
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

    const now = new Date();

    // End the session
    const session = await db.callSession.update({
      where: { id: sessionId },
      data: { endedAt: now }
    });

    // Set status back to Online
    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: { realtimeStatus: 'Online' }
    });

    revalidatePath('/dashboard');
    return {
      success: true,
      data: {
        durationSeconds: session.durationSeconds ?? 0,
        callCost: Number(session.callCost) ?? 0,
      },
    };
  } catch (error: any) {
    console.error('Error ending call:', error);
    return { success: false, error: 'Error ending call', code: 'INTERNAL_ERROR' };
  }
}

export async function getActiveCall(): Promise<ActionResult<CallSession | null>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await db.userProfile.findFirst({
      where: { 
        OR: [
          { id: userId },
          { clerkId: userId }
        ]
      },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: true, data: null };
    }

    const session = await db.callSession.findFirst({
      where: {
        interpreterId: profile.interpreterId,
        endedAt: null
      }
    });

    return { success: true, data: (session as CallSession) ?? null };
  } catch (error) {
    return { success: false, error: 'Error fetching active call', code: 'INTERNAL_ERROR' };
  }
}
