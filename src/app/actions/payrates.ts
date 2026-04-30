'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function updatePayrate(
  interpreterId: number,
  newRate: number
): Promise<ActionResult<{ oldRate: number; newRate: number }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // 1. Verify admin role using user_profiles table (RLS will also handle this if configured)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
    }

    if (newRate <= 0 || newRate > 999.99) {
      return { success: false, error: 'Rate must be between $0.01 and $999.99', code: 'VALIDATION_ERROR' };
    }

    // 2. Get current rate
    const { data: interpreter } = await supabase
      .from('interpreters')
      .select('tariff_per_minute')
      .eq('id', interpreterId)
      .single();

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    const oldRate = Number(interpreter.tariff_per_minute);

    // 3. Update rate
    const { error: updateError } = await supabase
      .from('interpreters')
      .update({ tariff_per_minute: newRate })
      .eq('id', interpreterId);

    if (updateError) throw updateError;

    // 4. Write audit log
    const { error: auditError } = await supabase
      .from('payrate_audit_log')
      .insert({
        interpreter_id: interpreterId,
        old_rate: oldRate,
        new_rate: newRate,
        changed_by: user.id,
      });

    if (auditError) throw auditError;

    revalidatePath('/admin');
    revalidatePath('/admin/payrates');
    revalidatePath('/payroll');
    return { success: true, data: { oldRate, newRate } };
  } catch (error: any) {
    console.error('Error updating payrate:', error.message);
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}

export async function getPayrateHistory(
  interpreterId: number
): Promise<ActionResult<any[]>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const { data: history, error } = await supabase
      .from('payrate_audit_log')
      .select('*')
      .eq('interpreter_id', interpreterId)
      .order('changed_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return { success: true, data: history ?? [] };
  } catch (error: any) {
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}
