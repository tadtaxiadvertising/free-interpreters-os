import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Trophy, TrendingUp, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import prismaClient from '@/lib/prisma';
import { getSystemConfig } from '@/app/actions/settings';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

/**
 * Ranking Page — Leaderboard of all active interpreters.
 *
 * Sorting criteria:
 *   1. Primary: Total minutes interpreted (session + log, descending)
 *   2. Tiebreaker: QA Score (highest wins)
 *
 * Each entry shows the interpreter's goal progress (MTD vs monthlyGoal).
 */
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

  const globalGoalHours = parseFloat(await getSystemConfig('standard_monthly_goal_hours', '120'));
  const globalGoalMinutes = globalGoalHours * 60;

  // Fetch all active interpreters with monthly data + latest QA score
  let rankings: any[] = [];
  try {
    const allInterpreters = await prisma.interpreter.findMany({
      where: { status: 'Activo' },
      select: {
        id: true,
        name: true,
        campaign: true,
        monthlyGoal: true,
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
        qaScores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { totalScore: true },
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
        const totalMinutes = sessionMin + logMin;
        const qaScore = interp.qaScores?.[0]?.totalScore ? Number(interp.qaScores[0].totalScore) : 0;
        const monthlyGoal = interp.monthlyGoal ?? globalGoalMinutes;
        const goalProgress = Math.min((totalMinutes / monthlyGoal) * 100, 100);

        return {
          id: interp.id,
          name: interp.name,
          campaign: interp.campaign,
          totalMinutes,
          qaScore,
          monthlyGoal,
          goalProgress,
        };
      })
      // Sort: primary by minutes DESC, tiebreaker by qaScore DESC
      .sort((a: any, b: any) => {
        if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
        return b.qaScore - a.qaScore;
      });
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
          <p className="text-sm text-slate-300">Posiciones basadas en horas interpretadas y QA Score</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-amber-500/10">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Tu Posición</p>
          <p className="text-3xl font-bold text-amber-400">#{myIdx >= 0 ? myIdx + 1 : '—'}</p>
          <p className="text-xs text-slate-300 mt-1">de {rankings.length} intérpretes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Tus Horas</p>
          <p className="text-3xl font-bold text-white">{(myIdx >= 0 ? rankings[myIdx].totalMinutes / 60 : 0).toFixed(1)}</p>
          <p className="text-xs text-slate-300 mt-1">hrs este mes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Promedio</p>
          <p className="text-3xl font-bold text-slate-200">{(avg / 60).toFixed(1)}</p>
          <p className="text-xs text-slate-300 mt-1">hrs promedio global</p>
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
                    <div className="flex items-center gap-3 mt-0.5">
                      {entry.campaign && (
                        <span className="text-xs text-slate-500">{entry.campaign}</span>
                      )}
                      {/* QA Score badge */}
                      {entry.qaScore > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          entry.qaScore >= 90
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-800 text-slate-400"
                        )}>
                          QA: {entry.qaScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={cn("text-lg font-bold", isMe ? "text-blue-400" : "text-white")}>{(entry.totalMinutes / 60).toFixed(1)}</p>
                    <p className="text-xs text-slate-400">hrs</p>
                  </div>
                  {/* Goal progress mini-bar */}
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span><Target size={10} className="inline" /> Meta</span>
                      <span>{entry.goalProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          entry.goalProgress >= 100
                            ? "bg-emerald-400"
                            : i === 0 ? "bg-amber-400" : isMe ? "bg-blue-400" : "bg-slate-600"
                        )}
                        style={{ width: `${entry.goalProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {rankings.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">
              No hay datos de ranking disponibles para este mes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
