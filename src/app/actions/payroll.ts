'use server';

import prisma from '@/lib/prisma';
import { createPayrollRecord } from '@/lib/payroll';
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
  } catch (error: any) {
    console.error('Failed to generate payroll:', error.message);
    return { success: false, error: error.message };
  }
}

