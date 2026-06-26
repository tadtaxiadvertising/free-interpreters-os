import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  Users, Phone, Activity, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import prismaClient from '@/lib/prisma';
import { GlobalGoalsButton } from '@/components/GlobalGoalsButton';
import { CSVChunkUploader } from '@/components/CSVChunkUploader';
import { getSystemConfig } from '@/app/actions/settings';

// Regla #2: Caching explícito (Next.js 15)
export const revalidate = 120;

const prisma = prismaClient; // Regla #4: Prisma Singleton para evitar DB exhaustion

// Regla #1: Next 15 Async Params
type PageProps = {
  params: Promise<{ [key: string]: string | string[] | undefined }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function AdminDashboard(props: PageProps) {
  // Desempaquetado asíncrono mandatario en Next 15
  await props.params;
  await props.searchParams;

  const { userId } = await auth();
  if (!userId) redirect('/login');

  let profile: any = null;
  try {
    profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { role: true, displayName: true }
    });
  } catch (error) {
    console.error('❌ ADMIN: Profile fetch failed:', error);
  }

  if (profile && profile.role !== 'admin') {
    redirect('/dashboard');
  }

  // Cálculos de tiempo para Telemetría MTD
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch Unificado y paralelo (Optimizado para Carga CPU/RAM en Easypanel)
  let interpreters: any[] = [];
  let activeCalls: any[] = [];
  let monthProductionLogs: any[] = [];
  let qaAlertsCount = 0;

  try {
    [interpreters, activeCalls, monthProductionLogs, qaAlertsCount] = await Promise.all([
      prisma.interpreter.findMany({
        select: {
          id: true,
          externalId: true,
          name: true,
          realtimeStatus: true,
          updatedAt: true,
        }
      }),
      prisma.callSession.findMany({
        where: { endedAt: null },
        select: { id: true }
      }),
      prisma.productionLog.findMany({
        where: { date: { gte: monthStart } },
        select: { interpretedMinutes: true, adherence: true }
      }),
      prisma.qAScore.count({
        where: {
          auditDate: { gte: monthStart },
          totalScore: { lt: 80 } // Score < 80 es considerado Alerta QA
        }
      })
    ]);
  } catch (error) {
    console.error('❌ ADMIN: Database fetch failed:', error);
  }

  // Agregación O(N) eficiente en CPU
  const totalMinutesMonth = monthProductionLogs.reduce((sum, log) => sum + (log.interpretedMinutes || 0), 0);

  const validAdherenceLogs = monthProductionLogs.filter(log => log.adherence && Number(log.adherence) > 0);
  const avgAdherence = validAdherenceLogs.length > 0
    ? validAdherenceLogs.reduce((sum, log) => sum + Number(log.adherence), 0) / validAdherenceLogs.length
    : 0;

  const globalGoalHours = parseFloat(await getSystemConfig('standard_monthly_goal_hours', '120'));

  const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes timeout
  const nowTime = new Date().getTime();

  const onlineCount = interpreters.filter((i: any) =>
    i.realtimeStatus === 'Online' &&
    (nowTime - new Date(i.updatedAt).getTime() < STALE_THRESHOLD)
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Telemetría Central</h2>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Dashboard Administrador • Caching ISR Habilitado (120s)
          </p>
        </div>
        <div className="flex gap-3">
          <GlobalGoalsButton initialGoal={globalGoalHours} />
        </div>
      </header>

      {/* Tarjetas de KPI principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Intérpretes Activos', value: interpreters.length, sub: `${onlineCount} Online Now`, icon: Users, color: 'text-purple-400' },
          { label: 'Minutos Mensuales', value: totalMinutesMonth.toLocaleString(), sub: `MTD Production`, icon: Activity, color: 'text-blue-400' },
          { label: 'Tasa de Adherencia', value: `${avgAdherence.toFixed(1)}%`, sub: 'Promedio Global', icon: CheckCircle2, color: 'text-green-400' },
          { label: 'Alertas de QA (<80%)', value: qaAlertsCount, sub: 'Evaluaciones críticas', icon: AlertTriangle, color: 'text-red-400' },
        ].map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={80} />
            </div>
            <div className={cn("p-3 rounded-2xl bg-white/5 w-fit mb-2", stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white mt-1 leading-none">{stat.value}</h3>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {/* Uploader de archivos optimizado (Client Component) */}
          <CSVChunkUploader />
        </div>

        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border border-white/5 bg-slate-900/40">
            <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-4">
              Estado de Red en Vivo
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-orange-500/30 transition-colors">
                <div className="flex items-center gap-3">
                  <Phone className="text-orange-400" />
                  <span className="text-white font-medium">Llamadas Activas</span>
                </div>
                <span className="text-2xl font-bold text-orange-400 animate-pulse">{activeCalls.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
