'use server';

import { createClient } from '@/lib/supabase/server';
import { createPayrollRecord } from '@/lib/payroll';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/types';

export async function generatePayrollPeriod(
  startDate?: Date,
  endDate?: Date
): Promise<ActionResult<{ message: string }>> {
  const supabase = await createClient();
  
  try {
    const now = new Date();
    const periodStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = endDate || new Date(now.getFullYear(), now.getMonth(), 15);

    
    // Obtener todos los intérpretes activos
    const { data: interpreters, error: interpError } = await supabase
      .from('interpreters')
      .select('id')
      .eq('status', 'Activo');
    
    if (interpError || !interpreters || interpreters.length === 0) {
      return { success: false, error: 'No active interpreters found to process payroll.' };
    }

    let successCount = 0;
    
    for (const interpreter of interpreters) {
      try {
        // Check if payroll already generated for this period
        const { data: existing } = await supabase
          .from('payroll_records')
          .select('id')
          .eq('interpreter_id', interpreter.id)
          .eq('period_start', periodStart.toISOString().split('T')[0])
          .eq('period_end', periodEnd.toISOString().split('T')[0])
          .maybeSingle();
        
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
