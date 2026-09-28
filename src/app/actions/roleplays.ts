'use server';

import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  calculateRoleplayScore,
  CreateRoleplaySessionSchema,
  ROLEPLAY_AUDIO_BUCKET,
  RoleplayEvaluationSchema,
  RoleplaySubmissionSchema,
} from '@/lib/roleplay';
import { revalidatePath } from 'next/cache';

type ActionResult = { success: boolean; error?: string; code?: string };

function fileExtension(type: string) {
  return ({ 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' } as Record<string, string>)[type] ?? 'webm';
}

/** Creates an assigned session after placing the administrator's base audio in private Storage. */
export async function createRoleplaySession(formData: FormData): Promise<ActionResult & { sessionId?: string }> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };
  const parsed = CreateRoleplaySessionSchema.safeParse({
    interpreterId: formData.get('interpreterId') || undefined,
    recruitmentCandidateId: formData.get('recruitmentCandidateId') || undefined,
    baseAudio: formData.get('baseAudio'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.', code: 'VALIDATION_ERROR' };
  const { baseAudio, ...subject } = parsed.data;
  const sessionId = crypto.randomUUID();
  const objectKey = `base/${sessionId}.${fileExtension(baseAudio.type)}`;
  try {
    const { error: uploadError } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET)
      .upload(objectKey, baseAudio, { contentType: baseAudio.type, upsert: false });
    if (uploadError) throw uploadError;
    try {
      await prisma.roleplaySession.create({ data: { id: sessionId, ...subject, baseAudioUrl: objectKey } });
    } catch (databaseError) {
      await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).remove([objectKey]);
      throw databaseError;
    }
  } catch (error) {
    console.error('[ROLEPLAY] Base audio upload failed:', error);
    return { success: false, error: 'No se pudo crear la sesión de roleplay.', code: 'SERVICE_UNAVAILABLE' };
  }
  revalidatePath('/admin/roleplays');
  return { success: true, sessionId };
}

/** Uploads the interpreter response and stores only its Storage object key in Postgres. */
export async function submitRoleplayRecording(formData: FormData): Promise<ActionResult> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  const parsed = RoleplaySubmissionSchema.safeParse({
    sessionId: formData.get('sessionId'),
    audio: formData.get('audio'),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Archivo inválido.', code: 'VALIDATION_ERROR' };

  const { sessionId, audio } = parsed.data;
  const session = await prisma.roleplaySession.findUnique({
    where: { id: sessionId }, select: { id: true, interpreterId: true, recordedAudioUrl: true },
  });
  if (!session) return { success: false, error: 'La sesión no existe.', code: 'NOT_FOUND' };
  if (session.recordedAudioUrl) return { success: false, error: 'Esta sesión ya fue enviada.', code: 'CONFLICT' };
  if (auth.profile?.role !== 'admin' && session.interpreterId !== auth.profile?.interpreterId) {
    return { success: false, error: 'No tienes acceso a esta sesión.', code: 'UNAUTHORIZED' };
  }

  const objectKey = `responses/${session.id}/${crypto.randomUUID()}.${fileExtension(audio.type)}`;
  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ROLEPLAY_AUDIO_BUCKET)
      .upload(objectKey, audio, { contentType: audio.type, upsert: false });
    if (uploadError) throw uploadError;

    try {
      await prisma.roleplaySession.update({
        where: { id: session.id },
        data: { recordedAudioUrl: objectKey, submittedAt: new Date() },
      });
    } catch (databaseError) {
      await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).remove([objectKey]);
      throw databaseError;
    }
  } catch (error) {
    console.error('[ROLEPLAY] Recording upload failed:', error);
    return { success: false, error: 'No se pudo guardar el audio. Inténtalo de nuevo.', code: 'SERVICE_UNAVAILABLE' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/admin/roleplays');
  return { success: true };
}

/** Applies the same weighted QA formula as the normal QA module. */
export async function evaluateRoleplay(formData: FormData): Promise<ActionResult> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  const parsed = RoleplayEvaluationSchema.safeParse({
    sessionId: formData.get('sessionId'),
    protocolScore: formData.get('protocolScore'), interpretationScore: formData.get('interpretationScore'),
    languageScore: formData.get('languageScore'), serviceScore: formData.get('serviceScore'),
    technicalScore: formData.get('technicalScore'), criticalError: formData.get('criticalError') === 'on',
    comments: formData.get('comments') || undefined,
  });
  if (!parsed.success) return { success: false, error: 'Revisa los puntajes ingresados.', code: 'VALIDATION_ERROR' };
  const input = parsed.data;
  const totalScore = calculateRoleplayScore(input);
  const actionRequired = input.criticalError || totalScore < 70 ? 'Advertencia / Coaching' : totalScore < 85 ? 'Feedback Requerido' : 'Ninguna';

  try {
    await prisma.$transaction(async (tx) => {
      const session = await tx.roleplaySession.findUnique({ where: { id: input.sessionId } });
      if (!session?.recordedAudioUrl) throw new Error('ROLEPLAY_NOT_READY');
      if (session.qaScoreId) throw new Error('ROLEPLAY_EVALUATED');

      const qaScore = await tx.qAScore.create({
        data: {
          interpreterId: session.interpreterId, auditDate: new Date(), auditor: auth.user.email ?? 'System Admin',
          protocolScore: input.protocolScore, interpretationScore: input.interpretationScore,
          languageScore: input.languageScore, serviceScore: input.serviceScore, technicalScore: input.technicalScore,
          totalScore, criticalError: input.criticalError, comentarios: input.comments, accionRequerida: actionRequired,
        }, select: { id: true },
      });
      await tx.roleplaySession.update({
        where: { id: session.id },
        data: { status: 'EVALUATED', evaluatorId: auth.user.id, qaScoreId: qaScore.id, evaluatedAt: new Date() },
      });
      if (session.recruitmentCandidateId) {
        await tx.recruitmentCandidate.update({ where: { id: session.recruitmentCandidateId }, data: { resultRoleplay: Math.round(totalScore) } });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLEPLAY_NOT_READY') return { success: false, error: 'Aún no hay audio para evaluar.', code: 'CONFLICT' };
    if (error instanceof Error && error.message === 'ROLEPLAY_EVALUATED') return { success: false, error: 'Esta sesión ya fue evaluada.', code: 'CONFLICT' };
    console.error('[ROLEPLAY] Evaluation failed:', error);
    return { success: false, error: 'No se pudo registrar la evaluación.', code: 'INTERNAL_ERROR' };
  }

  revalidatePath(`/admin/roleplays/${input.sessionId}`);
  revalidatePath('/admin/roleplays');
  revalidatePath('/qa');
  return { success: true };
}
