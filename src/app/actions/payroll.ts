'use server';

import prisma from '@/lib/prisma';
import { createPayrollRecord } from '@/lib/payroll';
import { refreshPayrollRecord } from '@/services/PayrollService';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types';

const db = prisma;

export async function generatePayrollPeriod(
  startDate?: Date,
  endDate?: Date
): Promise<ActionResult<{ message: string }>> {
  try {
    const now = new Date();
    const periodStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate || new Date(now.getFullYear(), now.getMonth(), 15);

    // Obtener todos los intérpretes activos via Prisma
    const interpreters = await db.interpreter.findMany({
      where: { status: 'Activo' },
      select: { id: true }
    });
    
    if (!interpreters || interpreters.length === 0) {
      return { success: false, error: 'No active interpreters found to process payroll.' };
    }

    let successCount = 0;
    
    for (const interpreter of interpreters) {
      try {
        // Check if payroll already generated for this period via Prisma
        const existing = await db.payrollRecord.findFirst({
          where: {
            interpreterId: interpreter.id,
            periodStart: periodStart,
            periodEnd: periodEnd
          }
        });
        
        if (!existing) {
          await createPayrollRecord(interpreter.id, periodStart, periodEnd);
          successCount++;
        }
      } catch (err: any) {
        console.error(`Error generating payroll for interpreter ${interpreter.id}:`, err.message);
      }
    }

    revalidatePath('/payroll');
    return { 
      success: true, 
      data: { message: `Successfully generated ${successCount} payroll records.` }
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to generate payroll:', message);
    return { success: false, error: message };
  }
}

export async function reconcileMinutes(
  logId: number,
  verifiedMinutes: number
): Promise<ActionResult<{ message: string }>> {
  try {
    const log = await db.productionLog.findUnique({
      where: { id: logId }
    });

    if (!log) {
      return { success: false, error: 'Production log not found' };
    }

    const linkedPaidPayroll = await db.payrollRecord.findFirst({
      where: {
        interpreterId: log.interpreterId,
        status: 'PAID',
        periodStart: { lte: log.date },
        periodEnd: { gte: log.date }
      }
    });

    if (linkedPaidPayroll) {
      return { success: false, error: 'Cannot modify verifiedMinutes: Log is linked to a PAID payroll record' };
    }

    await db.productionLog.update({
      where: { id: logId },
      data: { verifiedMinutes }
    });

    // Automatically refresh the payroll record if it exists and is pending
    if (log.interpreterId) {
      await refreshPayrollRecord(log.interpreterId, log.date);
    }

    revalidatePath('/payroll');
    revalidatePath('/dashboard');
    return { success: true, data: { message: 'Minutes successfully reconciled and payroll updated' } };
  } catch (_error: unknown) {
    return { success: false, error: 'Internal Server Error' };
  }
}
