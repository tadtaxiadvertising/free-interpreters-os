'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { CallSession } from '@prisma/client';

const db = prisma;

export async function startCall(): Promise<ActionResult<{ sessionId: number; startedAt: string }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // Use Prisma for profile lookup
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
    }

    // Check for existing active call via Prisma
    const activeCall = await db.callSession.findFirst({
      where: {
        interpreterId: profile.interpreterId,
        endedAt: null
      }
    });

    if (activeCall) {
      return { success: false, error: 'A call is already active', code: 'CONFLICT' };
    }

    // Fetch current tariff via Prisma
    const interpreter = await db.interpreter.findUnique({
      where: { id: profile.interpreterId },
      select: { tariffPerMinute: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter record not found', code: 'NOT_FOUND' };
    }

    // Create call session via Prisma
    const session = await db.callSession.create({
      data: {
        interpreterId: profile.interpreterId,
        tariffSnapshot: interpreter.tariffPerMinute,
      }
    });

    // Auto-set status to Busy via Prisma
    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: { realtimeStatus: 'Busy' }
    });

    revalidatePath('/dashboard');
    return {
      success: true,
      data: { 
        sessionId: session.id, 
        startedAt: session.startedAt?.toISOString() ?? new Date().toISOString() 
      },
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error starting call:', errorMsg);
    return { success: false, error: 'Error starting call', code: 'INTERNAL_ERROR' };
  }
}

export async function endCall(
  sessionId: number
): Promise<ActionResult<{ durationSeconds: number; callCost: number }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
    }

    // End the session via Prisma
    // The database trigger trg_calculate_call_metrics will handle duration and cost
    const session = await db.callSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() }
    });

    // Set status back to Online via Prisma
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
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error ending call:', errorMsg);
    return { success: false, error: 'Error ending call', code: 'INTERNAL_ERROR' };
  }
}

export async function getActiveCall(): Promise<ActionResult<CallSession | null>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
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

    return { success: true, data: session ?? null };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching active call:', errorMsg);
    return { success: false, error: 'Error fetching active call', code: 'INTERNAL_ERROR' };
  }
}

export async function addManualCall(formData: FormData): Promise<ActionResult<CallSession>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  // Verify admin status via Prisma (eliminates DNS risk from supabase.from())
  const profile = await db.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });

  if (profile?.role !== 'admin') {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  const interpreterId = parseInt(formData.get('interpreterId') as string);
  const startedAt = new Date(formData.get('startedAt') as string);
  const durationMinutes = parseFloat(formData.get('durationMinutes') as string);
  const notes = formData.get('notes') as string;

  if (isNaN(interpreterId) || isNaN(durationMinutes) || !startedAt || isNaN(startedAt.getTime())) {
    return { success: false, error: 'Invalid input data', code: 'VALIDATION_ERROR' };
  }

  try {
    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { tariffPerMinute: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    const durationSeconds = Math.round(durationMinutes * 60);
    const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const callCost = (durationSeconds / 60) * Number(interpreter.tariffPerMinute);

    const session = await db.callSession.create({
      data: {
        interpreterId,
        startedAt,
        endedAt,
        durationSeconds,
        tariffSnapshot: interpreter.tariffPerMinute,
        callCost,
        notes: notes || 'Manual entry by Administrator',
      }
    });

    revalidatePath('/admin/calls');
    return { success: true, data: session };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error adding manual call:', errorMsg);
    return { success: false, error: 'Error adding manual call', code: 'INTERNAL_ERROR' };
  }
}
