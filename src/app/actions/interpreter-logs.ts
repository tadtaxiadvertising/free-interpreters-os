'use server';

import prisma from '@/lib/prisma';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { validateAction } from '@/lib/auth/actions';
import { ActionResult } from '@/lib/types';
import { refreshPayrollRecord } from '@/services/PayrollService';
import { z } from 'zod';

const db = prisma;

const ProductionLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format").transform(val => new Date(`${val}T12:00:00Z`)),
  interpretedMinutes: z.coerce.number().positive('Minutes must be positive'),
  callsAttended: z.coerce.number().int().nonnegative().default(0),
  observations: z.string().trim().optional(),
});

export async function createInterpreterLog(formData: FormData): Promise<ActionResult> {
  const auth = await validateAction('interpreter');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  const profile = auth.profile;
  if (!profile.interpreterId) {
    return { success: false, error: 'User not linked to an interpreter profile', code: 'BAD_REQUEST' };
  }

  try {
    const rawData = {
      date: formData.get('date'),
      interpretedMinutes: formData.get('interpretedMinutes') || formData.get('minutes'),
      callsAttended: formData.get('callsAttended') || formData.get('calls'),
      observations: formData.get('observations'),
    };

    const validated = ProductionLogSchema.parse(rawData);

    // Prevent logging for future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (validated.date > today) {
      return { success: false, error: 'Cannot log production for future dates', code: 'VALIDATION_ERROR' };
    }
    // Atomic check and create using transaction or lean check
    const existingLog = await db.productionLog.findFirst({
      where: {
        interpreterId: profile.interpreterId,
        date: validated.date
      },
      select: { id: true }
    });

    if (existingLog) {
      return { 
        success: false, 
        error: 'A log already exists for this date. Please contact an admin to modify it.',
        code: 'CONFLICT'
      };
    }

    await db.productionLog.create({
      data: {
        interpreterId: profile.interpreterId,
        date: validated.date,
        interpretedMinutes: validated.interpretedMinutes,
        callsAttended: validated.callsAttended,
        status: 'Completed',
        observaciones: validated.observations,
        adherence: 100
      },
      select: { id: true }
    });

    // Refresh payroll record for this period
    await refreshPayrollRecord(profile.interpreterId, validated.date);

    revalidateInterpreterProfileRecords(profile.interpreterId);
    
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos de registro inválidos', code: 'VALIDATION_ERROR' };
    }
    console.error('Error creating production log:', error);
    return { success: false, error: 'Failed to create log', code: 'INTERNAL_ERROR' };
  }
}
