'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult, RealtimeStatus } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function updateInterpreterStatus(
  newStatus: RealtimeStatus
): Promise<ActionResult<{ status: RealtimeStatus }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // 1. Get the interpreter ID linked to this user
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('interpreter_id')
      .eq('id', user.id);
    
    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (profileError || !profile?.interpreter_id) {
      return { success: false, error: 'No interpreter linked to this account', code: 'NOT_FOUND' };
    }

    // 2. Update the status in the interpreters table
    // RLS will ensure the user can only update their own record
    const { error: updateError } = await supabase
      .from('interpreters')
      .update({ realtime_status: newStatus })
      .eq('id', profile.interpreter_id);

    if (updateError) {
      console.error('Error updating status:', updateError.message);
      return { success: false, error: updateError.message, code: 'INTERNAL_ERROR' };
    }

    revalidatePath('/dashboard');
    return { success: true, data: { status: newStatus } };
  } catch (error: any) {
    console.error('Unexpected error updating status:', error);
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}
