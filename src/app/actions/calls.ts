'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult, CallSession } from '@/lib/types';

export async function startCall(): Promise<ActionResult<{ sessionId: number; startedAt: string }>> {
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

  // Check for existing active call
  const { data: activeCall } = await supabase
    .from('call_sessions')
    .select('id')
    .eq('interpreter_id', profile.interpreter_id)
    .is('ended_at', null)
    .limit(1)
    .single();

  if (activeCall) {
    return { success: false, error: 'A call is already active', code: 'CONFLICT' };
  }

  // Fetch current tariff to snapshot
  const { data: interpreter } = await supabase
    .from('interpreters')
    .select('tariffPerMinute')
    .eq('id', profile.interpreter_id)
    .single();

  if (!interpreter) {
    return { success: false, error: 'Interpreter record not found', code: 'NOT_FOUND' };
  }

  const now = new Date().toISOString();

  // Create call session + set status to Busy in one flow
  const { data: session, error } = await supabase
    .from('call_sessions')
    .insert({
      interpreter_id: profile.interpreter_id,
      started_at: now,
      tariff_snapshot: interpreter.tariffPerMinute,
    })
    .select('id, started_at')
    .single();

  if (error || !session) {
    return { success: false, error: error?.message || 'Failed to create call', code: 'SERVICE_UNAVAILABLE' };
  }

  // Auto-set status to Busy
  await supabase
    .from('interpreters')
    .update({ realtime_status: 'Busy' })
    .eq('id', profile.interpreter_id);

  return {
    success: true,
    data: { sessionId: session.id, startedAt: session.started_at },
  };
}

export async function endCall(
  sessionId: number
): Promise<ActionResult<{ durationSeconds: number; callCost: number }>> {
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

  const now = new Date().toISOString();

  // Set ended_at — generated columns compute the rest
  const { error: updateError } = await supabase
    .from('call_sessions')
    .update({ ended_at: now })
    .eq('id', sessionId)
    .eq('interpreter_id', profile.interpreter_id)
    .is('ended_at', null);

  if (updateError) {
    return { success: false, error: updateError.message, code: 'SERVICE_UNAVAILABLE' };
  }

  // Re-fetch to get computed columns
  const { data: session } = await supabase
    .from('call_sessions')
    .select('duration_seconds, call_cost')
    .eq('id', sessionId)
    .single();

  // Set status back to Online
  await supabase
    .from('interpreters')
    .update({ realtime_status: 'Online' })
    .eq('id', profile.interpreter_id);

  return {
    success: true,
    data: {
      durationSeconds: session?.duration_seconds ?? 0,
      callCost: session?.call_cost ?? 0,
    },
  };
}

export async function getActiveCall(): Promise<ActionResult<CallSession | null>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('interpreter_id')
    .eq('id', user.id)
    .single();

  if (!profile?.interpreter_id) {
    return { success: true, data: null };
  }

  const { data: session } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('interpreter_id', profile.interpreter_id)
    .is('ended_at', null)
    .limit(1)
    .single();

  return { success: true, data: (session as CallSession) ?? null };
}
