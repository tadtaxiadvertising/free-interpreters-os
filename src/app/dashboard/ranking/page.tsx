import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Trophy, TrendingUp, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

  let profile: any = null;
  try {
    profile = await prisma.userProfile.findUnique({ where: { id: userId } });
  } catch (e) {
    console.error('❌ RANKING: Profile fetch failed:', e);
  }

  // Get all active interpreters with their monthly data
  let rankings: any[] = [];
  try {
    const allInterpreters = await prisma.interpreter.findMany({
      where: { status: 'Activo' },
      select: {
        id: true,
        name: true,
        campaign: true,
        callSessions: {
          where: {
            startedAt: { gte: startOfMonth, lte: endOfMonth },
            endedAt: { not: null },
          },
          select: { durationSeconds: true },
        },
        productionLogs: {
          where: { date: { gte: startOfMonth, lte: endOfMonth } },
          select: { interpretedMinutes: true },
        },
      },
    });

    rankings = allInterpreters
      .map((interp: any) => {
        const sessionMin = Math.round(
          (interp.callSessions || []).reduce((s: number, c: any) => s + (c.durationSeconds || 0), 0) / 60
        );
        const logMin = (interp.productionLogs || []).reduce(
          (s: number, l: any) => s + (l.interpretedMinutes || 0), 0
        );
        return {
          id: interp.id,
          name: interp.name,
          campaign: interp.campaign,
          totalMinutes: sessionMin + logMin,
        };
      })
      .sort((a: any, b: any) => b.totalMinutes - a.totalMinutes);
  } catch (error) {
    console.error('❌ RANKING: Data fetch failed:', error);
  }

  const totalAll = rankings.reduce((s: number, r: any) => s + r.totalMinutes, 0);
  const avg = rankings.length > 0 ? Math.round(totalAll / rankings.length) : 0;
  const myIdx = rankings.findIndex((r: any) => r.id === profile?.interpreterId);

  const monthName = new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white capitalize">Ranking — {monthName}</h1>
          <p className="text-sm text-slate-400">Posiciones basadas en minutos interpretados este mes</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-amber-500/10">
          <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-bold">Tu Posición</p>
          <p className="text-3xl font-bold text-amber-400">#{myIdx >= 0 ? myIdx + 1 : '—'}</p>
          <p className="text-xs text-slate-400 mt-1">de {rankings.length} intérpretes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-bold">Tus Minutos</p>
          <p className="text-3xl font-bold text-white">{myIdx >= 0 ? rankings[myIdx].totalMinutes : 0}</p>
          <p className="text-xs text-slate-400 mt-1">min este mes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-bold">Promedio</p>
          <p className="text-3xl font-bold text-slate-300">{avg}</p>
          <p className="text-xs text-slate-400 mt-1">min promedio global</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Tabla de Posiciones
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {rankings.map((entry: any, i: number) => {
            const isMe = entry.id === profile?.interpreterId;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center justify-between px-6 py-4 transition-all",
                  isMe && "bg-blue-500/10 border-l-4 border-blue-500",
                  !isMe && "hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-lg font-bold w-8 text-center",
                    i < 3 ? "text-amber-400" : "text-slate-500"
                  )}>
                    {medal || `#${i + 1}`}
                  </span>
                  <div>
                    <p className={cn("font-semibold", isMe ? "text-blue-400" : "text-white")}>
                      {entry.name} {isMe && <span className="text-xs">(Tú)</span>}
                    </p>
                    {entry.campaign && (
                      <p className="text-xs text-slate-500">{entry.campaign}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn("text-lg font-bold", isMe ? "text-blue-400" : "text-white")}>{entry.totalMinutes}</p>
                    <p className="text-xs text-slate-500">min</p>
                  </div>
                  {/* Bar relative to top performer */}
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        i === 0 ? "bg-amber-400" : isMe ? "bg-blue-400" : "bg-slate-600"
                      )}
                      style={{ width: `${rankings[0]?.totalMinutes ? (entry.totalMinutes / rankings[0].totalMinutes) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {rankings.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500">
              No hay datos de ranking disponibles para este mes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
