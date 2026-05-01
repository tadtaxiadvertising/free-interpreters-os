import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Phone, Clock, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusToggle } from '../../components/StatusToggle';
import { CallTimer } from '../../components/CallTimer';
import { CallHistory } from '../../components/CallHistory';
import { OnboardingGate } from '../../components/OnboardingGate';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function InterpreterDashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

  let profile: any = null;
  try {
    profile = await (prisma as any).userProfile.findUnique({
      where: { id: userId },
      include: {
        interpreter: {
          include: {
            productionLogs: {
              where: {
                date: { gte: startOfMonth, lte: endOfMonth }
              }
            },
            qaScores: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ DASHBOARD: Profile fetch failed:', error);
  }

  if (profile && profile.role === 'admin') {
    redirect('/admin');
  }

  const interpreter = profile?.interpreter || null;

  // Fetch today's and month's call sessions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let activeCall: any = null;
  let todayCalls: any[] = [];
  let recentCalls: any[] = [];
  let monthCalls: any[] = [];

  if (interpreter) {
    try {
      [activeCall, todayCalls, recentCalls, monthCalls] = await Promise.all([
        prisma.callSession.findFirst({
          where: { interpreterId: interpreter.id, endedAt: null },
          orderBy: { startedAt: 'desc' }
        }),
        prisma.callSession.findMany({
          where: { interpreterId: interpreter.id, startedAt: { gte: todayStart }, endedAt: { not: null } }
        }),
        prisma.callSession.findMany({
          where: { interpreterId: interpreter.id, endedAt: { not: null } },
          orderBy: { startedAt: 'desc' },
          take: 50 // Increased for filtering
        }),
        prisma.callSession.findMany({
          where: { 
            interpreterId: interpreter.id, 
            startedAt: { gte: startOfMonth, lte: endOfMonth },
            endedAt: { not: null }
          }
        })
      ]);
    } catch (error) {
      console.error('❌ DASHBOARD: Data fetch failed:', error);
    }
  }

  const todayMinutes = Math.round(
    todayCalls.reduce((sum: number, c: any) => sum + (c.durationSeconds || 0), 0) / 60
  );
  const todayEarnings = todayCalls.reduce((sum: number, c: any) => sum + (Number(c.callCost) || 0), 0);
  const todayCallCount = todayCalls.length;

  // Gamification Metrics (Combined Production Logs + Call Sessions)
  const logMinutes = interpreter?.productionLogs?.reduce((sum: number, log: any) => sum + (log.interpretedMinutes || 0), 0) || 0;
  const sessionMinutes = Math.round(
    monthCalls.reduce((sum: number, c: any) => sum + (c.durationSeconds || 0), 0) / 60
  );
  
  const mtdMinutes = logMinutes + sessionMinutes;
  
  // ── DYNAMIC MONTHLY GOAL: pulled from interpreter.monthlyGoal (DB) ──
  const monthlyGoal = interpreter?.monthlyGoal ?? 2000;
  const mtdProgress = Math.min((mtdMinutes / monthlyGoal) * 100, 100);
  
  const latestQaScore = interpreter?.qaScores?.[0]?.totalScore ? Number(interpreter.qaScores[0].totalScore) : 0;
  const isQaExcellent = latestQaScore >= 90;
  
  const mtdEarnings = monthCalls.reduce((sum: number, c: any) => sum + (Number(c.callCost) || 0), 0) + 
    (logMinutes * Number(interpreter?.tariffPerMinute || 0));

  // ── Check onboarding status ──
  const onboardingComplete = profile?.onboardingComplete ?? false;

  if (!profile || !interpreter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass p-8 rounded-3xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Account Access Error</h2>
          <p className="text-gray-300">
            {!profile ? "Your user profile could not be found." : "No interpreter profile is linked to your account."}
            <br /><br />
            <span className="text-xs text-orange-400 font-mono">Infrastructure Error: DATABASE_UNAVAILABLE</span>
          </p>
          <a href="/login" className="mt-6 inline-block bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-xl text-sm transition-all">
            Refresh Session
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding gate — shows wizard if not completed */}
      <OnboardingGate 
        isComplete={onboardingComplete} 
        interpreterName={interpreter.name} 
      />

      <div className="space-y-8 animate-in fade-in duration-700">
        {/* Hero Section & Gamification */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/20 p-8 shadow-2xl">
          <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 p-32 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Hola, {interpreter.name}</h2>
                {isQaExcellent && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    Top Tier QA ✨
                  </span>
                )}
              </div>
              <p className="text-slate-200 font-medium">
                {interpreter.languageA} ↔ {interpreter.languageB}
                {interpreter.campaign && <span className="ml-3 text-indigo-300">• {interpreter.campaign}</span>}
              </p>
            </div>
            <StatusToggle currentStatus={interpreter.realtimeStatus as any} />
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* MTD Progress — DYNAMIC GOAL */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-white font-semibold mb-1">Actas de MTD</p>
                  <p className="text-3xl font-bold text-white">{mtdMinutes}<span className="text-lg text-slate-300"> / {monthlyGoal}</span></p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Clock size={24} />
                </div>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full relative"
                  style={{ width: `${mtdProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              <p className="text-xs text-slate-200 mt-2 text-right font-medium">{mtdProgress.toFixed(1)}% de la meta mensual</p>
            </div>

            {/* QA Score — IMPROVED CONTRAST */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-white font-semibold">QA Score</p>
                <div className={cn("p-2 rounded-xl", isQaExcellent ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-200")}>
                  <ShieldCheck size={20} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={cn("text-4xl font-bold", isQaExcellent ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "text-white")}>
                  {latestQaScore}%
                </p>
                {isQaExcellent && <span className="text-sm font-medium text-emerald-400">¡Excelente!</span>}
              </div>
            </div>

            {/* Earnings — IMPROVED CONTRAST */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm flex flex-col justify-center">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-white font-semibold">Ganancias MTD</p>
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <DollarSign size={20} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-white tracking-tight">
                  ${mtdEarnings.toFixed(2)}
                </p>
                <span className="text-slate-300 text-sm font-medium">({(mtdMinutes / 60).toFixed(1)} hrs)</span>
              </div>
              <p className="text-xs text-slate-200 mt-2 font-medium">Tarifa: ${(Number(interpreter.tariffPerMinute || 0) * 60).toFixed(2)}/hr</p>
            </div>
          </div>
        </div>

        {/* Call Timer */}
        <div className="glass rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp size={22} className="text-blue-400" />
            <h3 className="text-xl font-bold text-white">Temporizador</h3>
          </div>
          <CallTimer
            activeCall={activeCall ? {
              sessionId: activeCall.id,
              startedAt: activeCall.startedAt.toISOString(),
              tariffSnapshot: Number(activeCall.tariffSnapshot),
            } : null}
            currentRate={Number(interpreter.tariffPerMinute)}
          />
        </div>

        {/* Recent Calls */}
        <CallHistory 
          calls={recentCalls.map((c: any) => ({
            id: c.id,
            started_at: c.startedAt.toISOString(),
            ended_at: c.endedAt?.toISOString() || null,
            duration_seconds: c.durationSeconds,
            call_cost: Number(c.callCost),
            tariff_snapshot: Number(c.tariffSnapshot)
          }))} 
        />
      </div>
    </>
  );
}
