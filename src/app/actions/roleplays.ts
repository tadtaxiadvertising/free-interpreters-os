'use server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getCurrentUser, validateAction } from '@/lib/auth/actions';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateRoleplayScore, CreateRoleplaySessionSchema, ROLEPLAY_AUDIO_BUCKET, RoleplayEvaluationSchema } from '@/lib/roleplay';

type Result = { success: boolean; error?: string; code?: string };
const hashToken = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const extension = (type: string) => ({ 'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' }[type.split(';')[0]] ?? 'webm');
const metadata = (raw: unknown) => { const data = raw as { size?: unknown; type?: unknown }; const size = Number(data?.size); const type = typeof data?.type === 'string' ? data.type.split(';')[0] : ''; return size > 0 && size <= 15 * 1024 * 1024 && ['audio/webm','audio/mpeg','audio/mp4','audio/ogg'].includes(type) ? { size, type } : null; };

async function candidateGrant(sessionId: string) {
  const token = (await cookies()).get('roleplay_access')?.value;
  if (!token) return false;
  return Boolean(await prisma.roleplayAccess.findFirst({ where: { sessionId, tokenHash: hashToken(token), expiresAt: { gt: new Date() } }, select: { id: true } }));
}

/** Returns a short-lived Storage upload capability; audio bytes never traverse Next.js. */
export async function requestRoleplayUpload(sessionId: string, rawMetadata: unknown): Promise<Result & { path?: string; token?: string }> {
  const audio = metadata(rawMetadata); if (!audio) return { success: false, error: 'Audio inválido. Máximo 15 MB.', code: 'VALIDATION_ERROR' };
  const auth = await getCurrentUser();
  const session = await prisma.roleplaySession.findUnique({ where: { id: sessionId }, select: { interpreterId: true, recruitmentCandidateId: true, recordedAudioUrl: true } });
  if (!session || session.recordedAudioUrl) return { success: false, error: 'La sesión ya no acepta respuestas.', code: 'CONFLICT' };
  const allowed = session.interpreterId !== null ? Boolean(auth && (auth.profile?.role === 'admin' || session.interpreterId === auth.profile?.interpreterId)) : await candidateGrant(sessionId);
  if (!allowed) return { success: false, error: 'No tienes acceso a esta sesión.', code: 'UNAUTHORIZED' };
  const path = `responses/${sessionId}/${crypto.randomUUID()}.${extension(audio.type)}`;
  try { const { data, error } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).createSignedUploadUrl(path); if (error || !data) throw error; return { success: true, path, token: data.token }; } catch (error) { console.error('[ROLEPLAY] upload URL:', error); return { success: false, error: 'No se pudo preparar la carga.', code: 'SERVICE_UNAVAILABLE' }; }
}

export async function requestBaseRoleplayUpload(rawMetadata: unknown): Promise<Result & { path?: string; token?: string }> {
  const auth = await validateAction('admin'); if ('error' in auth) return { success: false, error: auth.error, code: auth.code };
  const audio = metadata(rawMetadata); if (!audio) return { success: false, error: 'Audio inválido. Máximo 15 MB.', code: 'VALIDATION_ERROR' };
  const path = `base/${crypto.randomUUID()}.${extension(audio.type)}`;
  try { const { data, error } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).createSignedUploadUrl(path); if (error || !data) throw error; return { success: true, path, token: data.token }; } catch { return { success: false, error: 'No se pudo preparar la carga.', code: 'SERVICE_UNAVAILABLE' }; }
}

/** Commits an already uploaded object with a conditional update: exactly one response can win. */
export async function confirmRoleplayUpload(sessionId: string, path: string): Promise<Result> {
  if (!path.startsWith(`responses/${sessionId}/`)) return { success: false, error: 'Referencia de audio inválida.', code: 'VALIDATION_ERROR' };
  const auth = await getCurrentUser();
  const session = await prisma.roleplaySession.findUnique({ where: { id: sessionId }, select: { interpreterId: true } });
  const allowed = session?.interpreterId !== null && session?.interpreterId !== undefined ? Boolean(auth && (auth.profile?.role === 'admin' || session.interpreterId === auth.profile?.interpreterId)) : await candidateGrant(sessionId);
  if (!session || !allowed) return { success: false, error: 'No tienes acceso a esta sesión.', code: 'UNAUTHORIZED' };
  const { data: objects } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).list(`responses/${sessionId}`, { search: path.split('/').at(-1) });
  if (!objects?.some((object: { name: string }) => `responses/${sessionId}/${object.name}` === path)) return { success: false, error: 'El audio no se encontró en Storage.', code: 'NOT_FOUND' };
  const updated = await prisma.roleplaySession.updateMany({ where: { id: sessionId, recordedAudioUrl: null }, data: { recordedAudioUrl: path, submittedAt: new Date() } });
  if (!updated.count) { await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).remove([path]); return { success: false, error: 'Otra respuesta ya fue enviada.', code: 'CONFLICT' }; }
  revalidatePath('/dashboard/roleplays'); revalidatePath('/admin/roleplays'); return { success: true };
}

/** Creates metadata only after the admin client uploaded and confirmed the base object. */
export async function createRoleplaySession(input: { interpreterId?: number; recruitmentCandidateId?: number; baseAudioPath: string }): Promise<Result & { sessionId?: string; inviteUrl?: string }> {
  const auth = await validateAction('admin'); if ('error' in auth) return { success: false, error: auth.error, code: auth.code };
  const parsed = CreateRoleplaySessionSchema.safeParse({ ...input, baseAudio: new File(['x'], 'metadata.webm', { type: 'audio/webm' }) });
  if (!parsed.success || !input.baseAudioPath.startsWith('base/')) return { success: false, error: 'Datos de sesión inválidos.', code: 'VALIDATION_ERROR' };
  const { data: baseObjects } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).list('base', { search: input.baseAudioPath.slice('base/'.length) });
  if (!baseObjects?.some((object: { name: string }) => `base/${object.name}` === input.baseAudioPath)) return { success: false, error: 'El audio base no se encontró en Storage.', code: 'NOT_FOUND' };
  const id = crypto.randomUUID(); const rawToken = crypto.randomBytes(32).toString('base64url');
  try { await prisma.$transaction(async (tx) => { await tx.roleplaySession.create({ data: { id, interpreterId: input.interpreterId, recruitmentCandidateId: input.recruitmentCandidateId, baseAudioUrl: input.baseAudioPath } }); if (input.recruitmentCandidateId) await tx.roleplayAccess.create({ data: { sessionId: id, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }); }); } catch (error) { console.error('[ROLEPLAY] create:', error); return { success: false, error: 'No se pudo crear la sesión.' }; }
  revalidatePath('/admin/roleplays'); return { success: true, sessionId: id, inviteUrl: input.recruitmentCandidateId ? `/roleplays/invite/${rawToken}` : undefined };
}

export async function evaluateRoleplay(formData: FormData): Promise<Result> {
  const auth = await validateAction('admin'); if ('error' in auth) return { success: false, error: auth.error, code: auth.code };
  const parsed = RoleplayEvaluationSchema.safeParse({ sessionId: formData.get('sessionId'), protocolScore: formData.get('protocolScore'), interpretationScore: formData.get('interpretationScore'), languageScore: formData.get('languageScore'), serviceScore: formData.get('serviceScore'), technicalScore: formData.get('technicalScore'), criticalError: formData.get('criticalError') === 'on', comments: formData.get('comments') || undefined });
  if (!parsed.success) return { success: false, error: 'Revisa los puntajes ingresados.', code: 'VALIDATION_ERROR' }; const input = parsed.data; const totalScore = calculateRoleplayScore(input); const action = input.criticalError || totalScore < 70 ? 'Advertencia / Coaching' : totalScore < 85 ? 'Feedback Requerido' : 'Ninguna';
  try { await prisma.$transaction(async (tx) => { const claimed = await tx.roleplaySession.updateMany({ where: { id: input.sessionId, qaScoreId: null, recordedAudioUrl: { not: null } }, data: { evaluatorId: auth.user.id } }); if (!claimed.count) throw new Error('CLAIM_FAILED'); const session = await tx.roleplaySession.findUniqueOrThrow({ where: { id: input.sessionId } }); const score = await tx.qAScore.create({ data: { interpreterId: session.interpreterId, auditDate: new Date(), auditor: auth.user.email ?? 'System Admin', protocolScore: input.protocolScore, interpretationScore: input.interpretationScore, languageScore: input.languageScore, serviceScore: input.serviceScore, technicalScore: input.technicalScore, totalScore, criticalError: input.criticalError, comentarios: input.comments, accionRequerida: action } }); await tx.roleplaySession.update({ where: { id: input.sessionId }, data: { status: 'EVALUATED', qaScoreId: score.id, evaluatedAt: new Date() } }); if (session.recruitmentCandidateId) await tx.recruitmentCandidate.update({ where: { id: session.recruitmentCandidateId }, data: { resultRoleplay: Math.round(totalScore) } }); }); } catch (error) { return { success: false, error: 'La sesión ya fue evaluada o aún no tiene respuesta.', code: 'CONFLICT' }; }
  revalidatePath(`/admin/roleplays/${input.sessionId}`); revalidatePath('/admin/roleplays'); revalidatePath('/recruitment'); return { success: true };
}
