'use server';

import prismaClient from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getCurrentProfile } from './auth';
import { refreshPayrollRecord } from '@/services/PayrollService';

const prisma = prismaClient;

export async function createInterpreterLog(formData: FormData) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const profile = await getCurrentProfile();
  if (!profile || !profile.interpreter_id) {
    throw new Error('User not linked to an interpreter profile');
  }

  const date = new Date(formData.get('date') as string);
  const interpretedMinutes = parseInt(formData.get('minutes') as string, 10);
  const callsAttended = parseInt(formData.get('calls') as string, 10) || 0;
  const observations = formData.get('observations') as string;

  if (isNaN(interpretedMinutes) || interpretedMinutes <= 0) {
    return { error: 'Invalid minutes' };
  }

  // Prevent logging for future dates
  if (date > new Date()) {
    return { error: 'Cannot log production for future dates' };
  }

  try {
    // Check if log already exists for this date
    const existingLog = await prisma.productionLog.findFirst({
      where: {
        interpreterId: profile.interpreter_id,
        date: {
          equals: date
        }
      }
    });

    if (existingLog) {
      return { error: 'A log already exists for this date. Please contact an admin to modify it.' };
    }

    const log = await prisma.productionLog.create({
      data: {
        interpreterId: profile.interpreter_id,
        date,
        interpretedMinutes,
        callsAttended,
        status: 'Completed',
        observaciones: observations,
        adherence: 100 // Default for manual log if not specified
      }
    });

    // Refresh payroll record for this period
    await refreshPayrollRecord(profile.interpreter_id, date);

    revalidatePath('/dashboard');
    revalidatePath('/production');
    
    return { success: true };
  } catch (error: any) {
    console.error('Error creating production log:', error);
    return { error: 'Failed to create log: ' + error.message };
  }
}
