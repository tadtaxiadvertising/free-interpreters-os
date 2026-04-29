'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { createNotification } from './notifications';

export type QAScoreInput = {
  sessionId: string;
  interpreterId: string;
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

  // 1. Calculate Total Score based on BUSINESS_LOGIC.md weights
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

  // 2. Determine Action Required based on score
  let actionRequired = 'None';
  if (input.criticalError || totalScore < 70) {
    actionRequired = 'Advertencia / Coaching';
  } else if (totalScore < 85) {
    actionRequired = 'Feedback Requerido';
  }

  // 3. Save to database
  const user = (await supabase.auth.getUser()).data.user;
  
  const { data, error } = await supabase
    .from('qa_scores')
    .insert({
      session_id: input.sessionId,
      interpreter_id: input.interpreterId,
      total_score: totalScore,
      protocol_score: input.protocolScore,
      interpretation_score: input.interpretationScore,
      language_score: input.languageScore,
      service_score: input.serviceScore,
      technical_score: input.technicalScore,
      critical_error: input.criticalError,
      comments: input.comments,
      action_required: actionRequired,
      evaluated_by: user?.id
    })
    .select()
    .single();

  if (error) {
    console.error('QA Submission Error:', error);
    return { success: false, error: error.message };
  }

  // 4. Notify Interpreter (Async/Fire & Forget)
  try {
    const interpreter = await prisma.interpreter.findUnique({
      where: { id: Number(input.interpreterId) },
      select: { emailCorporativo: true, name: true }
    });

    if (interpreter?.emailCorporativo) {
      // Find the user profile matching this email to get the auth ID
      const profile = await prisma.userProfile.findFirst({
        where: { email: interpreter.emailCorporativo }
      });

      if (profile) {
        await createNotification({
          userId: profile.id,
          title: 'QA Evaluation Ready',
          message: `Your session score: ${totalScore.toFixed(1)}%. Action: ${actionRequired}`,
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

