'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateAction } from '@/lib/auth/actions';
import { ActionResult } from '@/lib/types';
import { refreshPayrollRecord } from '@/services/PayrollService';

const db = prisma;

export async function createInterpreterLog(formData: FormData): Promise<ActionResult> {
  const auth = await validateAction('interpreter');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  const profile = auth.profile;
  if (!profile.interpreterId) {
    return { success: false, error: 'User not linked to an interpreter profile', code: 'BAD_REQUEST' };
  }

  const dateStr = formData.get('date') as string;
  const minutesStr = formData.get('minutes') as string;
  const callsStr = formData.get('calls') as string;
  const observations = formData.get('observations') as string;

  const date = new Date(dateStr);
  const interpretedMinutes = parseInt(minutesStr, 10);
  const callsAttended = parseInt(callsStr, 10) || 0;

  if (isNaN(interpretedMinutes) || interpretedMinutes <= 0) {
    return { success: false, error: 'Invalid minutes', code: 'VALIDATION_ERROR' };
  }

  // Prevent logging for future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (date > today) {
    return { success: false, error: 'Cannot log production for future dates', code: 'VALIDATION_ERROR' };
  }

  try {
    // Check if log already exists for this date
    const existingLog = await db.productionLog.findFirst({
      where: {
        interpreterId: profile.interpreterId,
        date: {
          equals: date
        }
      }
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
        date,
        interpretedMinutes,
        callsAttended,
        status: 'Completed',
        observaciones: observations,
        adherence: 100 // Default for manual log if not specified
      }
    });

    // Refresh payroll record for this period
    await refreshPayrollRecord(profile.interpreterId, date);

    revalidatePath('/dashboard');
    revalidatePath('/production');
    
    return { success: true };
  } catch (error) {
    console.error('Error creating production log:', error);
    return { success: false, error: 'Failed to create log', code: 'INTERNAL_ERROR' };
  }
}
