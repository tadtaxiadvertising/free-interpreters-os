'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult, PayrateAuditEntry } from '@/lib/types';

export async function updatePayrate(
  interpreterId: number,
  newRate: number
): Promise<ActionResult<{ oldRate: number; newRate: number }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  // Verify admin role
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

  // Get current rate
  const { data: interpreter } = await supabase
    .from('interpreters')
    .select('tariffPerMinute')
    .eq('id', interpreterId)
    .single();

  if (!interpreter) {
    return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
  }

  const oldRate = Number(interpreter.tariffPerMinute);

  // Update rate
  const { error: updateError } = await supabase
    .from('interpreters')
    .update({ tariffPerMinute: newRate })
    .eq('id', interpreterId);

  if (updateError) {
    return { success: false, error: updateError.message, code: 'SERVICE_UNAVAILABLE' };
  }

  // Write audit log
  await supabase
    .from('payrate_audit_log')
    .insert({
      interpreter_id: interpreterId,
      old_rate: oldRate,
      new_rate: newRate,
      changed_by: user.id,
    });

  return { success: true, data: { oldRate, newRate } };
}

export async function getPayrateHistory(
  interpreterId: number
): Promise<ActionResult<PayrateAuditEntry[]>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const { data, error } = await supabase
    .from('payrate_audit_log')
    .select('*')
    .eq('interpreter_id', interpreterId)
    .order('changed_at', { ascending: false })
    .limit(20);

  if (error) {
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }

  return { success: true, data: (data as PayrateAuditEntry[]) ?? [] };
}
