import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Trophy, TrendingUp, Target, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface InterpreterRankingSummary {
  position: number;
  totalEligible: number;
  score: number;
  ownProductionMinutes: number;
  ownGoalProgress: number;
  ownQaScore: number | null;
  percentile?: number;
}

async function fetchPrivateRanking(): Promise<InterpreterRankingSummary | null> {
  try {
    const res = await fetch('/api/dashboard/ranking', {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export default async function RankingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const ranking = await fetchPrivateRanking();

  const monthName = new Date().toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });

  if (!ranking) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex items-center gap-3">
          <Trophy size={28} className="text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white capitalize">Ranking — {monthName}</h1>
            <p className="text-sm text-slate-300">Tu posición y métricas privadas</p>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 border border-white/5 text-center">
          <p className="text-slate-400">No hay datos de ranking disponibles para este mes.</p>
        </div>
      </div>
    );
  }

  const { position, totalEligible, score, ownProductionMinutes, ownGoalProgress, ownQaScore, percentile } = ranking;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white capitalize">Mi Ranking — {monthName}</h1>
          <p className="text-sm text-slate-300">Tu posición privada basada en producción, QA y adherencia</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 border border-amber-500/10">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Tu Posición</p>
          <p className="text-3xl font-bold text-amber-400">#{position}</p>
          <p className="text-xs text-slate-300 mt-1">de {totalEligible} intérpretes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Tu Score</p>
          <p className="text-3xl font-bold text-white">{score.toFixed(1)}</p>
          <p className="text-xs text-slate-300 mt-1">puntos ponderados</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Tus Horas</p>
          <p className="text-3xl font-bold text-white">{(ownProductionMinutes / 60).toFixed(1)}</p>
          <p className="text-xs text-slate-300 mt-1">hrs este mes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">Percentil</p>
          <p className="text-3xl font-bold text-blue-400">{percentile ?? 0}%</p>
          <p className="text-xs text-slate-300 mt-1">superas al {percentile ?? 0}%</p>
        </div>
      </div>

      {/* Detailed metrics */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Detalle de Métricas
          </h3>
        </div>
        <div className="divide-y divide-white/5 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Production */}
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Producción Verificada</p>
              <p className="text-2xl font-bold text-white">{(ownProductionMinutes / 60).toFixed(1)} hrs</p>
              <p className="text-sm text-slate-400 mt-1">{ownProductionMinutes} minutos totales</p>
            </div>
            {/* Goal Progress */}
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Progreso de Meta</p>
              <p className="text-2xl font-bold text-emerald-400">{ownGoalProgress.toFixed(1)}%</p>
              <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(ownGoalProgress, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QA Score */}
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">QA Score Promedio</p>
              <p className="text-2xl font-bold {ownQaScore !== null && ownQaScore >= 90 ? 'text-emerald-400' : 'text-white'}">
                {ownQaScore !== null ? `${ownQaScore}%` : 'Sin datos'}
              </p>
              {ownQaScore !== null && (
                <p className="text-xs text-slate-400 mt-1">
                  {ownQaScore >= 90 ? 'Excelente' : ownQaScore >= 80 ? 'Bueno' : 'Mejorable'}
                </p>
              )}
            </div>
            {/* Percentile context */}
            <div>
              <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide">Comparativa</p>
              <p className="text-2xl font-bold text-blue-400">Top {100 - (percentile ?? 0)}%</p>
              <p className="text-xs text-slate-400 mt-1">
                Superas al {percentile ?? 0}% de los {totalEligible} intérpretes activos
              </p>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="pt-4 border-t border-white/5">
            <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Cómo se calcula tu Score</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-xl bg-slate-800/50">
                <p className="text-xs text-slate-400">Producción (50%)</p>
                <p className="text-sm font-bold text-white">Basada en minutos verificados</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50">
                <p className="text-xs text-slate-400">QA (30%)</p>
                <p className="text-sm font-bold text-white">Calidad de interpretación</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50">
                <p className="text-xs text-slate-400">Adherencia (15%)</p>
                <p className="text-sm font-bold text-white">Cumplimiento de horarios</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50">
                <p className="text-xs text-slate-400">Consistencia (5%)</p>
                <p className="text-sm font-bold text-white">Días activos en el mes</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Pesos configurables en SystemConfig — ver <code className="font-mono">ranking_weight_*</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}