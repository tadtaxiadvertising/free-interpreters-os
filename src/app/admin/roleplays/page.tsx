import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export default async function RoleplaysQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.profile?.role !== 'admin') redirect('/dashboard');
  const [pending, history] = await Promise.all(['PENDING', 'EVALUATED'].map((status) => prisma.roleplaySession.findMany({ where: { status: status as 'PENDING' | 'EVALUATED', recordedAudioUrl: { not: null } }, orderBy: { submittedAt: 'asc' }, include: { interpreter: { select: { name: true } }, recruitmentCandidate: { select: { name: true } }, qaScore: { select: { totalScore: true } } } })));
  const table = (sessions: typeof pending, empty: string) => <section className="overflow-hidden rounded-2xl border border-white/10"><table className="w-full text-left"><thead className="bg-slate-900 text-sm text-slate-300"><tr><th className="p-4">Participante</th><th className="p-4">Estado</th><th className="p-4">Puntaje</th><th className="p-4" /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id} className="border-t border-white/10"><td className="p-4">{session.interpreter?.name ?? session.recruitmentCandidate?.name ?? 'Sin asignar'}</td><td className="p-4">{session.status === 'PENDING' ? 'Pendiente' : 'Evaluado'}</td><td className="p-4">{session.qaScore ? `${Number(session.qaScore.totalScore ?? 0).toFixed(2)}%` : '—'}</td><td className="p-4 text-right"><Link className="font-semibold text-blue-300 hover:text-blue-200" href={`/admin/roleplays/${session.id}`}>Abrir</Link></td></tr>)}{sessions.length === 0 && <tr><td className="p-8 text-center text-slate-400" colSpan={4}>{empty}</td></tr>}</tbody></table></section>;
  return <main className="space-y-6 p-8 text-white"><header className="flex justify-between"><div><p className="text-sm font-bold uppercase tracking-widest text-blue-300">QA</p><h1 className="mt-2 text-3xl font-bold">Cola de roleplays</h1></div><Link className="rounded-xl bg-blue-600 px-4 py-3 font-bold" href="/admin/roleplays/new">Crear roleplay</Link></header><h2 className="font-bold">Pendientes</h2>{table(pending, 'No hay respuestas pendientes.')}<h2 className="font-bold">Historial</h2>{table(history, 'No hay roleplays evaluados.')}</main>;
}
