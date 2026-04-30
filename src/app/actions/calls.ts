'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult, CallSession } from '@/lib/types';
import { revalidatePath } from 'next/cache';

export async function startCall(): Promise<ActionResult<{ sessionId: number; startedAt: string }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('interpreter_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.interpreter_id) {
      return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
    }

    // Check for existing active call
    const { data: activeCall } = await supabase
      .from('call_sessions')
      .select('id')
      .eq('interpreter_id', profile.interpreter_id)
      .is('ended_at', null)
      .maybeSingle();

    if (activeCall) {
      return { success: false, error: 'A call is already active', code: 'CONFLICT' };
    }

    // Fetch current tariff
    const { data: interpreter, error: interpreterError } = await supabase
      .from('interpreters')
      .select('tariff_per_minute')
      .eq('id', profile.interpreter_id)
      .single();

    if (interpreterError || !interpreter) {
      return { success: false, error: 'Interpreter record not found', code: 'NOT_FOUND' };
    }

    // Create call session
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert({
        interpreter_id: profile.interpreter_id,
        tariff_snapshot: interpreter.tariff_per_minute,
      })
      .select()
      .single();

    if (sessionError) {
      return { success: false, error: sessionError.message, code: 'INTERNAL_ERROR' };
    }

    // Auto-set status to Busy
    await supabase
      .from('interpreters')
      .update({ realtime_status: 'Busy' })
      .eq('id', profile.interpreter_id);

    revalidatePath('/dashboard');
    return {
      success: true,
      data: { sessionId: session.id, startedAt: session.started_at },
    };
  } catch (error: any) {
    console.error('Error starting call:', error);
    return { success: false, error: 'Error starting call', code: 'INTERNAL_ERROR' };
  }
}

export async function endCall(
  sessionId: number
): Promise<ActionResult<{ durationSeconds: number; callCost: number }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('interpreter_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.interpreter_id) {
      return { success: false, error: 'No interpreter linked', code: 'NOT_FOUND' };
    }

    // End the session
    // The database trigger trg_calculate_call_metrics will handle duration and cost
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    if (sessionError) {
      return { success: false, error: sessionError.message, code: 'INTERNAL_ERROR' };
    }

    // Set status back to Online
    await supabase
      .from('interpreters')
      .update({ realtime_status: 'Online' })
      .eq('id', profile.interpreter_id);

    revalidatePath('/dashboard');
    return {
      success: true,
      data: {
        durationSeconds: session.duration_seconds ?? 0,
        callCost: Number(session.call_cost) ?? 0,
      },
    };
  } catch (error: any) {
    console.error('Error ending call:', error);
    return { success: false, error: 'Error ending call', code: 'INTERNAL_ERROR' };
  }
}

export async function getActiveCall(): Promise<ActionResult<any>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('interpreter_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.interpreter_id) {
      return { success: true, data: null };
    }

    const { data: session } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('interpreter_id', profile.interpreter_id)
      .is('ended_at', null)
      .maybeSingle();

    return { success: true, data: session ?? null };
  } catch (error) {
    return { success: false, error: 'Error fetching active call', code: 'INTERNAL_ERROR' };
  }
}
