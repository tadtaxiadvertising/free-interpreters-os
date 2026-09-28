import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ROLEPLAY_AUDIO_BUCKET } from '@/lib/roleplay';
import { RoleplayEvaluationForm } from '@/components/roleplays/RoleplayEvaluationForm';

export const dynamic = 'force-dynamic';
export default async function AdminRoleplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.profile?.role !== 'admin') redirect('/dashboard');
  const session = await prisma.roleplaySession.findUnique({ where: { id }, include: { interpreter: { select: { name: true } }, recruitmentCandidate: { select: { name: true } }, qaScore: true } });
  if (!session) notFound();
  const [base, recorded] = await Promise.all([session.baseAudioUrl, session.recordedAudioUrl].map(async (key) => key ? supabaseAdmin.storage.from(ROLEPLAY_AUDIO_BUCKET).createSignedUrl(key, 1800) : { data: null }));
  return <main className="mx-auto max-w-5xl space-y-7 p-8 text-white"><header><p className="text-sm font-bold uppercase tracking-widest text-blue-300">Auditoría de roleplay</p><h1 className="mt-2 text-3xl font-bold">{session.interpreter?.name ?? session.recruitmentCandidate?.name ?? 'Participante'}</h1></header><div className="grid gap-6 lg:grid-cols-2"><section className="space-y-5 rounded-2xl border border-white/10 bg-slate-900/60 p-6"><h2 className="font-bold">Audio base</h2>{base.data?.signedUrl && <audio controls className="w-full" src={base.data.signedUrl} />}<h2 className="pt-3 font-bold">Respuesta grabada</h2>{recorded.data?.signedUrl ? <audio controls className="w-full" src={recorded.data.signedUrl} /> : <p className="text-slate-400">Aún no se ha enviado una respuesta.</p>}</section><section>{session.qaScore ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"><h2 className="font-bold">Evaluación completada</h2><p className="mt-2 text-3xl font-bold">{Number(session.qaScore.totalScore ?? 0).toFixed(2)}%</p></div> : <RoleplayEvaluationForm sessionId={session.id} />}</section></div></main>;
}
