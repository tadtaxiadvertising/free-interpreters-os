'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createNotification } from './notifications';

export type QAScoreInput = {
  productionLogId: number;
  interpreterId: number;
  protocolScore: number;      // 20%
  interpretationScore: number; // 40%
  languageScore: number;       // 20%
  serviceScore: number;        // 10%
  technicalScore: number;      // 10%
  criticalError: boolean;      // Auto-fail
  comments?: string;
};

export async function submitQAEvaluation(input: QAScoreInput) {
  const supabase = await createClient();

  // Note: Total score calculation is handled by database trigger trg_calculate_qa_total
  // We still calculate it here for the notification, but the DB is the source of truth.
  let totalScore = 0;
  if (input.criticalError) {
    totalScore = 0;
  } else {
    totalScore = 
      (input.protocolScore * 0.20) +
      (input.interpretationScore * 0.40) +
      (input.languageScore * 0.20) +
      (input.serviceScore * 0.10) +
      (input.technicalScore * 0.10);
  }

  // Determine Action Required based on score
  let actionRequired = 'Ninguna';
  if (input.criticalError || totalScore < 70) {
    actionRequired = 'Advertencia / Coaching';
  } else if (totalScore < 85) {
    actionRequired = 'Feedback Requerido';
  }

  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('qa_scores')
    .insert({
      production_log_id: input.productionLogId,
      interpreter_id: input.interpreterId,
      audit_date: new Date().toISOString(),
      auditor: user?.email || 'System',
      protocol_score: input.protocolScore,
      interpretation_score: input.interpretationScore,
      language_score: input.languageScore,
      service_score: input.serviceScore,
      technical_score: input.technicalScore,
      critical_error: input.criticalError,
      comentarios: input.comments,
      accion_requerida: actionRequired
    })
    .select()
    .single();

  if (error) {
    console.error('QA Submission Error:', error.message);
    return { success: false, error: error.message };
  }

  // Notify Interpreter
  try {
    // 1. Get the interpreter's email
    const { data: interpreter } = await supabase
      .from('interpreters')
      .select('email_corporativo')
      .eq('id', input.interpreterId)
      .single();

    if (interpreter?.email_corporativo) {
      // 2. Find the auth user linked to this email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', interpreter.email_corporativo)
        .single();

      if (profile) {
        await createNotification({
          userId: profile.id,
          title: 'Evaluación QA Lista',
          message: `Tu puntaje de sesión: ${totalScore.toFixed(1)}%. Acción: ${actionRequired}`,
          type: totalScore >= 85 ? 'success' : (totalScore >= 70 ? 'info' : 'warning'),
          link: '/dashboard/earnings'
        });
      }
    }
  } catch (notifyErr) {
    console.error('Notification failed but QA saved:', notifyErr);
  }

  revalidatePath('/qa');
  revalidatePath(`/dashboard`);
  
  return { success: true, data };
}
