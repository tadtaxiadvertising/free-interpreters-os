'use server';

import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { z } from 'zod';

const db = prisma;

const QuickLogSchema = z.object({
  durationMinutes: z.coerce.number().min(0),
  seconds: z.coerce.number().min(0).max(59),
});

/**
 * ACTION: Quick Log (Interpreter self-service)
 * 
 * Creates both CallSession AND ProductionLog so metrics update immediately.
 * This is the interpreter's own quick-log button, not admin manual entry.
 */
export async function quickLog(formData: FormData): Promise<ActionResult<{ id: number }>> {
  const auth = await validateAction('interpreter');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const profile = auth.profile;
    if (!profile?.interpreterId) {
      return { success: false, error: 'Interpreter profile not found', code: 'NOT_FOUND' };
    }

    const rawData = {
      durationMinutes: formData.get('durationMinutes'),
      seconds: formData.get('seconds'),
    };

    const validated = QuickLogSchema.parse(rawData);
    const totalMinutes = validated.durationMinutes + (validated.seconds / 60);
    const durationSeconds = Math.round(totalMinutes * 60);

    if (durationSeconds <= 0) {
      return { success: false, error: 'Duration must be positive', code: 'VALIDATION_ERROR' };
    }

    const interpreter = await db.interpreter.findUnique({
      where: { id: profile.interpreterId },
      select: { id: true, tariffPerMinute: true },
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    // Use Santo Domingo timezone for date calculation
    const getLocalDateStr = (d: Date) => {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    };

    const now = new Date();
    const dayStr = getLocalDateStr(now);
    const logDate = new Date(`${dayStr}T12:00:00Z`);
    const endedAt = new Date(now.getTime() - durationSeconds * 1000);
    const startedAt = endedAt;
    const tariffSnapshot = Number(interpreter.tariffPerMinute || 0);
    const callCost = (durationSeconds / 60) * tariffSnapshot;

    const result = await db.$transaction(async (tx) => {
      // Create CallSession record
      const session = await tx.callSession.create({
        data: {
          interpreterId: interpreter.id,
          startedAt,
          endedAt: now,
          durationSeconds,
          tariffSnapshot,
          callCost,
          notes: 'Quick log by interpreter',
        },
        select: { id: true },
      });

      // Create/update ProductionLog for today
      const existingLog = await tx.productionLog.findFirst({
        where: {
          interpreterId: interpreter.id,
          date: logDate,
        },
      });

      if (existingLog) {
        await tx.productionLog.update({
          where: { id: existingLog.id },
          data: {
            interpretedMinutes: (existingLog.interpretedMinutes || 0) + Math.floor(durationSeconds / 60),
            callsAttended: (existingLog.callsAttended || 0) + 1,
          },
        });
      } else {
        await tx.productionLog.create({
          data: {
            interpreterId: interpreter.id,
            date: logDate,
            interpretedMinutes: Math.floor(durationSeconds / 60),
            callsAttended: 1,
            status: 'Completed',
            observaciones: 'Quick log sync',
            adherence: 100,
          },
        });
      }

      return session;
    });

    revalidatePath('/dashboard');
    revalidateInterpreterProfileRecords(profile.interpreterId);
    return { success: true, data: { id: result.id } };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data', code: 'VALIDATION_ERROR' };
    }
    console.error('🔴 ERROR [quickLog]:', error);
    return { success: false, error: 'Failed to save quick log', code: 'INTERNAL_ERROR' };
  }
}
