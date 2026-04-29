'use server';

import prisma from '@/lib/prisma';
import { createPayrollRecord, calculateBatchPayroll } from '@/lib/payroll';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types';

export async function generatePayrollPeriod(): Promise<ActionResult<{ message: string }>> {
  try {
    // Definir el período (ej. del 1 al 15 del mes actual)
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 15);
    
    // Obtener todos los intérpretes activos
    const interpreters = await prisma.interpreter.findMany({
      where: { status: 'Activo' },
      select: { id: true }
    });
    
    if (interpreters.length === 0) {
      return { success: false, error: 'No active interpreters found to process payroll.' };
    }

    let successCount = 0;
    
    for (const interpreter of interpreters) {
      try {
        // Check if payroll already generated for this period to avoid duplicates
        const existing = await prisma.payrollRecord.findFirst({
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
      } catch (err) {
        console.error(`Error generating payroll for interpreter ${interpreter.id}:`, err);
      }
    }

    revalidatePath('/payroll');
    return { 
      success: true, 
      data: { message: `Successfully generated ${successCount} payroll records.` }
    };
  } catch (error: any) {
    console.error('Failed to generate payroll:', error);
    return { success: false, error: error.message };
  }
}
