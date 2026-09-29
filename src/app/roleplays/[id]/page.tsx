import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ROLEPLAY_AUDIO_BUCKET } from '@/lib/roleplay';
import { RoleplayRecorder } from '@/components/roleplays/RoleplayRecorder';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export default async function RoleplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const session = await prisma.roleplaySession.findUnique({ where: { id }, select: { id: true, interpreterId: true, baseAudioUrl: true, recordedAudioUrl: true } });
  if (!session) notFound();
  const accessToken = (await cookies()).get('roleplay_access')?.value;
  const candidateAccess = !session.interpreterId && accessToken ? await prisma.roleplayAccess.findFirst({ where: { sessionId: id, tokenHash: crypto.createHash('sha256').update(accessToken).digest('hex'), expiresAt: { gt: new Date() } }, select: { id: true } }) : null;
  if (!user && !candidateAccess) redirect('/login');
  if (!candidateAccess && user?.profile?.role !== 'admin' && session.interpreterId !== user?.profile?.interpreterId) notFound();
  const { data, error } = await supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).createSignedUrl(session.baseAudioUrl, 60 * 30);
  if (error || !data?.signedUrl) throw new Error('No se pudo preparar el audio base.');
  if (session.recordedAudioUrl) return <main className="mx-auto max-w-2xl p-8 text-center text-slate-200">Esta respuesta ya fue enviada y está en revisión.</main>;
  return <main className="min-h-screen bg-slate-950 px-4 py-8"><RoleplayRecorder sessionId={session.id} baseAudioUrl={data.signedUrl} /></main>;
}
