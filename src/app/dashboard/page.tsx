import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Phone, Clock, DollarSign, TrendingUp, ShieldCheck, RefreshCw, LogIn, Plus, Trophy } from 'lucide-react';
import { getSystemConfig } from '@/app/actions/settings';
import { cn } from '@/lib/utils';
import { StatusToggle } from '@/components/StatusToggle';
import { CallTimer } from '@/components/CallTimer';
import { CallHistory } from '@/components/CallHistory';
import { OnboardingGate } from '@/components/OnboardingGate';
import { getCurrentProfile } from '@/app/actions/auth';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient;

export const dynamic = 'force-dynamic';

export default async function InterpreterDashboard() {
  const { userId, user } = await auth();
  if (!userId || !user) redirect('/login');

  let profile = await getCurrentProfile();

  // ── AUTO-REPAIR: If profile is missing but user exists in Auth ──
  if (!profile) {
    console.warn(`[DASHBOARD] Profile missing for user ${userId}, attempting auto-repair...`);
    try {
      // Use Prisma for auto-repair to avoid DNS/fetch issues
      // Try to link to an existing interpreter by email
      const interpreter = await prisma.interpreter.findUnique({
        where: { emailCorporativo: user.email },
        select: { id: true }
      });

      const newProfile: any = await prisma.userProfile.upsert({
        where: { id: userId },
        update: {
          email: user.email || '',
          displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Interpreter',
          role: 'interpreter',
          interpreterId: interpreter?.id || null,
        },
        create: {
          id: userId,
          email: user.email || '',
          displayName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Interpreter',
          role: 'interpreter',
          interpreterId: interpreter?.id || null,
        }
      });

      if (newProfile) {
        console.log(`[DASHBOARD] Profile auto-repaired for ${userId}`);
        profile = {
          id: newProfile.id,
          email: newProfile.email,
          role: newProfile.role as any,
          interpreter_id: newProfile.interpreterId,
          display_name: newProfile.displayName || '',
          terms_accepted_at: newProfile.termsAcceptedAt?.toISOString() || null,
          signature_date: newProfile.signatureDate?.toISOString() || null,
          bank_name: newProfile.bankName,
          bank_account: newProfile.bankAccount,
          bank_account_type: newProfile.bankAccountType,
          bank_cedula: newProfile.bankCedula,
          onboarding_complete: newProfile.onboardingComplete || false,
          created_at: newProfile.createdAt.toISOString(),
        };
      }
    } catch (err) {
      console.error('[DASHBOARD] Auto-repair failed via Prisma:', err);
    }

  }

  if (profile && profile.role === 'admin') {
    redirect('/admin');
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

  const globalGoalHours = parseFloat(await getSystemConfig('standard_monthly_goal_hours', '120'));

  // Fetch full data if we have an interpreter link
  let interpreter: any = null;
  let activeCall: any = null;
  let todayCalls: any[] = [];
  let recentCalls: any[] = [];
  let monthCalls: any[] = [];
  let rankings: any[] = [];
  let myRankIdx = -1;

  if (profile?.interpreter_id) {
    try {
      interpreter = await prisma.interpreter.findUnique({
        where: { id: profile.interpreter_id },
        select: {
          id: true,
          name: true,
          status: true,
          realtimeStatus: true,
          campaign: true,
          languageA: true,
          languageB: true,
          tariffPerMinute: true,
          monthlyGoal: true,
          productionLogs: { 
            where: { date: { gte: startOfMonth, lte: endOfMonth } },
            select: { interpretedMinutes: true } 
          },
          qaScores: { 
            take: 5, 
            orderBy: { createdAt: 'desc' },
            select: { totalScore: true } 
          }
        }
      } as any);

      if (interpreter) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [activeCallRes, todayCallsRes, recentCallsRes, monthCallsRes, allInterpreters] = await Promise.all([
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
            take: 10
          }),
          prisma.callSession.findMany({
            where: { 
              interpreterId: interpreter.id, 
              startedAt: { gte: startOfMonth, lte: endOfMonth },
              endedAt: { not: null }
            }
          }),
          prisma.interpreter.findMany({
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
          } as any)
        ]);

        activeCall = activeCallRes;
        todayCalls = todayCallsRes;
        recentCalls = recentCallsRes;
        monthCalls = monthCallsRes;

        // Process rankings
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
            const monthlyGoalVal = interp.monthlyGoal ?? (globalGoalHours * 60);
            const goalProgress = Math.min((totalMinutes / monthlyGoalVal) * 100, 100);

            return {
              id: interp.id,
              name: interp.name,
              campaign: interp.campaign,
              totalMinutes,
              qaScore,
              monthlyGoal: monthlyGoalVal,
              goalProgress,
            };
          })
          .sort((a: any, b: any) => {
            if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
            return b.qaScore - a.qaScore;
          });

        myRankIdx = rankings.findIndex((r: any) => r.id === interpreter.id);
      }
    } catch (error) {
      console.error('❌ DASHBOARD: Data fetch failed:', error);
    }
  }

  // ── 📊 METRICS CALCULATION ──
  const todayMinutes = (todayCalls || []).reduce((acc: number, call: any) => acc + (call.durationSeconds || 0), 0) / 60;
  const mtdMinutes = (monthCalls || []).reduce((acc: number, call: any) => acc + (call.durationSeconds || 0), 0) / 60;
  const monthlyGoal = interpreter?.monthlyGoal || (globalGoalHours * 60);
  const mtdProgress = Math.min((mtdMinutes / monthlyGoal) * 100, 100);
  
  // Daily target: monthly goal distributed over 22 working days
  const dailyGoal = monthlyGoal / 22;
  const todayProgress = Math.min((todayMinutes / dailyGoal) * 100, 100);
  
  const latestQaScore = interpreter?.qaScores?.[0]?.totalScore ? Number(interpreter.qaScores[0].totalScore) : 0;
  const isQaExcellent = latestQaScore >= 95;
  
  const mtdEarnings = (monthCalls || []).reduce((acc: number, call: any) => acc + Number(call.callCost || 0), 0);
  const onboardingComplete = profile?.onboarding_complete || false;

  if (!profile || !interpreter) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="glass p-10 rounded-[2.5rem] text-center max-w-lg border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-orange-500/10 blur-[100px] rounded-full -mr-16 -mt-16" />
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center text-orange-400 mx-auto mb-6 border border-orange-500/20">
              <ShieldCheck size={40} />
            </div>
            
            <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Acceso Restringido</h2>
            <p className="text-slate-300 leading-relaxed mb-8">
              {!profile 
                ? "No pudimos localizar tu perfil de usuario en el sistema." 
                : "Tu cuenta de usuario no está vinculada a un perfil de intérprete activo."}
              <br />
              <span className="text-slate-500 text-sm mt-4 block">
                Por favor, contacta al administrador para completar tu vinculación de ID corporativo.
              </span>
            </p>
            
            <div className="flex flex-col gap-3">
              <a 
                href="/dashboard" 
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-4 rounded-2xl font-bold transition-all border border-white/5"
              >
                <RefreshCw size={18} />
                Reintentar Conexión
              </a>
              <a 
                href="/login" 
                className="flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
              >
                <LogIn size={14} />
                Cerrar Sesión e Identificarse
              </a>
            </div>
            
            <div className="mt-10 pt-8 border-t border-white/5">
              <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">
                System Diagnostic: {profile ? 'INTERPRETER_LINK_MISSING' : 'PROFILE_MISSING_IN_DB'}
              </p>
            </div>
          </div>
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
                  <p className="text-sm text-white font-semibold mb-1">Horas MTD</p>
                  <p className="text-3xl font-bold text-white">
                    <span suppressHydrationWarning>{(mtdMinutes / 60).toFixed(1)}</span>
                    <span className="text-lg text-slate-300"> / {Math.round(monthlyGoal / 60)}</span>
                  </p>
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
              <p suppressHydrationWarning className="text-xs text-slate-200 mt-2 text-right font-medium">{mtdProgress.toFixed(1)}% de la meta mensual</p>
            </div>

            {/* Meta Diaria Progress */}
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-white font-semibold mb-1">Meta Diaria</p>
                  <p className="text-3xl font-bold text-white">
                    <span suppressHydrationWarning>{Math.round(todayMinutes)}</span>
                    <span className="text-lg text-slate-300"> / {Math.round(dailyGoal)} min</span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <TrendingUp size={24} />
                </div>
              </div>
              
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full relative"
                  style={{ width: `${todayProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
              
              <p suppressHydrationWarning className="text-xs text-slate-200 mt-2 text-right font-medium">
                {todayProgress.toFixed(1)}% completado (Faltan {Math.max(0, Math.round(dailyGoal - todayMinutes))} min)
              </p>
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
                  RD${mtdEarnings.toFixed(2)}
                </p>
                <span className="text-slate-300 text-sm font-medium">({(mtdMinutes / 60).toFixed(1)} hrs)</span>
              </div>
              <p className="text-xs text-slate-200 mt-2 font-medium">Tarifa: RD${(Number(interpreter.tariffPerMinute || 0) * 60).toFixed(2)}/hr</p>
            </div>
          </div>
        </div>

        {/* Quick Tools & Production Registry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Call Timer */}
          <div className="glass rounded-3xl p-8 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 bg-blue-500/5 blur-[50px] rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <TrendingUp size={22} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Temporizador en Vivo</h3>
              </div>
              <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-1 rounded-md uppercase tracking-wider border border-blue-500/20">Realtime</span>
            </div>
            <div className="relative z-10">
              <CallTimer
                activeCall={activeCall ? {
                  sessionId: activeCall.id,
                  startedAt: activeCall.startedAt.toISOString(),
                  tariffSnapshot: Number(activeCall.tariffSnapshot),
                } : null}
                currentRate={Number(interpreter.tariffPerMinute)}
              />
            </div>
          </div>

          {/* Ranking / Leaderboard */}
          <div className="glass rounded-3xl p-8 border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 bg-amber-500/5 blur-[50px] rounded-full -mr-8 -mt-8 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Trophy size={22} />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Tabla de Posiciones</h3>
              </div>
              <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md uppercase tracking-wider border border-amber-500/20">Monthly</span>
            </div>
            
            <div className="relative z-10 space-y-4">
              {rankings.slice(0, 3).map((entry: any, i: number) => {
                const isMe = entry.id === interpreter.id;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <div 
                    key={entry.id} 
                    className={cn(
                      "flex items-center justify-between p-2 rounded-xl transition-all",
                      isMe ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold w-6 text-center text-slate-400">
                        {medal || `#${i + 1}`}
                      </span>
                      <div>
                        <p className={cn("text-sm font-bold", isMe ? "text-blue-400" : "text-white")}>
                          {entry.name} {isMe && <span className="text-[10px] text-blue-400">(Tú)</span>}
                        </p>
                        <p className="text-[10px] text-slate-500">{entry.campaign || 'General'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-200">{(entry.totalMinutes / 60).toFixed(1)} hrs</p>
                      {entry.qaScore > 0 && (
                        <p className="text-[9px] font-bold text-emerald-400">QA: {entry.qaScore}%</p>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* If user is not in top 3, show their position row */}
              {myRankIdx >= 3 && (
                <>
                  <div className="border-t border-dashed border-white/10 my-2" />
                  <div className="flex items-center justify-between p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold w-6 text-center text-blue-400">
                        #{myRankIdx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-blue-400">
                          {rankings[myRankIdx]?.name} <span className="text-[10px]">(Tú)</span>
                        </p>
                        <p className="text-[10px] text-slate-500">{rankings[myRankIdx]?.campaign || 'General'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-400">{(rankings[myRankIdx]?.totalMinutes / 60).toFixed(1)} hrs</p>
                      {rankings[myRankIdx]?.qaScore > 0 && (
                        <p className="text-[9px] font-bold text-emerald-400">QA: {rankings[myRankIdx]?.qaScore}%</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Link 
                href="/dashboard/ranking"
                className="block text-center text-xs text-blue-400 hover:text-blue-300 font-bold mt-4 pt-2 hover:underline transition-all"
              >
                Ver Ranking Completo
              </Link>
            </div>
          </div>
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
