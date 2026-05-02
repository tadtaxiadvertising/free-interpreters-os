'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { createNotification } from './notifications';

const db = prisma as any;

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
  
  try {
    const data = await db.qAScore.create({
      data: {
        productionLogId: input.productionLogId,
        interpreterId: input.interpreterId,
        auditDate: new Date(),
        auditor: user?.email || 'System',
        protocolScore: input.protocolScore,
        interpretationScore: input.interpretationScore,
        languageScore: input.languageScore,
        serviceScore: input.serviceScore,
        technicalScore: input.technicalScore,
        criticalError: input.criticalError,
        comentarios: input.comments,
        accionRequerida: actionRequired
      }
    });

    // Notify Interpreter
    try {
      // 1. Get the interpreter via Prisma
      const interpreter = await db.interpreter.findUnique({
        where: { id: input.interpreterId },
        select: { emailCorporativo: true }
      });

      if (interpreter?.emailCorporativo) {
        // 2. Find the auth user linked to this email via Prisma
        const profile = await db.userProfile.findUnique({
          where: { email: interpreter.emailCorporativo },
          select: { id: true }
        });

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
    } catch (notifyErr: any) {
      console.error('Notification failed but QA saved:', notifyErr.message);
    }

    revalidatePath('/qa');
    revalidatePath(`/dashboard`);
    
    return { success: true, data };
  } catch (error: any) {
    console.error('QA Submission Error:', error.message);
    return { success: false, error: error.message };
  }
}

