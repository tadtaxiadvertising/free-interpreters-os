import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Phone, Clock, DollarSign, TrendingUp, ShieldCheck, RefreshCw, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusToggle } from '@/components/StatusToggle';
import { CallTimer } from '@/components/CallTimer';
import { CallHistory } from '@/components/CallHistory';
import { OnboardingGate } from '@/components/OnboardingGate';
import { getCurrentProfile } from '@/app/actions/auth';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function InterpreterDashboard() {
  const { userId, user } = await auth();
  if (!userId || !user) redirect('/login');

  let profile = await getCurrentProfile();

  // ── AUTO-REPAIR: If profile is missing but user exists in Auth ──
  if (!profile) {
    console.warn(`[DASHBOARD] Profile missing for user ${userId}, attempting auto-repair...`);
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabaseAdmin = createAdminClient();
      
      // Try to link to an existing interpreter by email
      const { data: interpreter } = await supabaseAdmin
        .from('interpreters')
        .select('id')
        .eq('email_corporativo', user.email)
        .maybeSingle();

      const { data: newProfile, error } = await supabaseAdmin.from('user_profiles').upsert({
        id: userId,
        email: user.email,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Interpreter',
        role: 'interpreter',
        interpreter_id: interpreter?.id || null,
      }, { onConflict: 'id' }).select().single();

      if (!error && newProfile) {
        console.log(`[DASHBOARD] Profile auto-repaired for ${userId}`);
        profile = {
          id: newProfile.id,
          email: newProfile.email,
          role: newProfile.role as any,
          interpreter_id: newProfile.interpreter_id,
          display_name: newProfile.display_name || '',
          terms_accepted_at: newProfile.terms_accepted_at,
          signature_date: newProfile.signature_date,
          bank_name: newProfile.bank_name,
          bank_account: newProfile.bank_account,
          bank_account_type: newProfile.bank_account_type,
          bank_cedula: newProfile.bank_cedula,
          onboarding_complete: newProfile.onboarding_complete || false,
          created_at: newProfile.created_at,
        };
      }
    } catch (err) {
      console.error('[DASHBOARD] Auto-repair failed:', err);
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

  // Fetch full data if we have an interpreter link
  let interpreter: any = null;
  let activeCall: any = null;
  let todayCalls: any[] = [];
  let recentCalls: any[] = [];
  let monthCalls: any[] = [];

  if (profile?.interpreter_id) {
    try {
      interpreter = await prisma.interpreter.findUnique({
        where: { id: profile.interpreter_id },
        include: {
          productionLogs: { where: { date: { gte: startOfMonth, lte: endOfMonth } } },
          qaScores: { take: 5, orderBy: { createdAt: 'desc' } }
        }
      });

      if (interpreter) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

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
            take: 10
          }),
          prisma.callSession.findMany({
            where: { 
              interpreterId: interpreter.id, 
              startedAt: { gte: startOfMonth, lte: endOfMonth },
              endedAt: { not: null }
            }
          })
        ]);
      }
    } catch (error) {
      console.error('❌ DASHBOARD: Data fetch failed:', error);
    }
  }

  // ── 📊 METRICS CALCULATION ──
  const mtdMinutes = (monthCalls || []).reduce((acc: number, call: any) => acc + (call.durationSeconds || 0), 0) / 60;
  const monthlyGoal = interpreter?.monthlyGoal || 2000;
  const mtdProgress = Math.min((mtdMinutes / monthlyGoal) * 100, 100);
  
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
