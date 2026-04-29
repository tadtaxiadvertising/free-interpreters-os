'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult, RealtimeStatus } from '@/lib/types';

export async function updateInterpreterStatus(
  newStatus: RealtimeStatus
): Promise<ActionResult<{ status: RealtimeStatus }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('interpreter_id')
    .eq('id', user.id)
    .single();

  if (!profile?.interpreter_id) {
    return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
  }

  const { error } = await supabase
    .from('interpreters')
    .update({ realtime_status: newStatus })
    .eq('id', profile.interpreter_id);

  if (error) {
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }

  return { success: true, data: { status: newStatus } };
}
