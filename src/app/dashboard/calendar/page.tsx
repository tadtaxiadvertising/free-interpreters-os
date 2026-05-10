import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { getInterpreterCommitment } from '@/app/actions/calendar';

export default async function InterpreterCalendarPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { interpreterId: true }
  });

  if (!profile || !profile.interpreterId) {
    return <div className="p-8 text-white">Interpreter profile not found.</div>;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const commitment = await getInterpreterCommitment(profile.interpreterId, todayStr);

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent mb-8">
        Mi Calendario de Metas
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-lg font-semibold text-slate-300 mb-2">Progreso Semanal</h2>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">{commitment.totalMinutesWeek}</span>
              <span className="text-slate-400 mb-1">/ {commitment.targetMinutesToDate} min esperados</span>
            </div>
            
            <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${commitment.healthScore >= 100 ? 'bg-emerald-500' : commitment.healthScore >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(100, commitment.healthScore)}%` }}
              />
            </div>
            <p className="text-sm mt-2 text-slate-400">Health Score: {commitment.healthScore}%</p>
          </div>
        </div>

        {commitment.deficit > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 relative overflow-hidden">
            <h2 className="text-lg font-semibold text-rose-400 mb-2">Plan de Recuperación</h2>
            <p className="text-sm text-slate-300 mb-4">
              Estás <span className="font-bold text-rose-400">{commitment.deficit} minutos</span> por debajo de tu meta para esta semana.
            </p>
            
            {commitment.recoverySuggestions && (
              <div className="space-y-2">
                <div className="bg-black/20 p-3 rounded-lg flex justify-between">
                  <span className="text-slate-300">Sábado</span>
                  <span className="font-bold text-emerald-400">+{commitment.recoverySuggestions.saturdayMinutes} min</span>
                </div>
                <div className="bg-black/20 p-3 rounded-lg flex justify-between">
                  <span className="text-slate-300">Domingo</span>
                  <span className="font-bold text-emerald-400">+{commitment.recoverySuggestions.sundayMinutes} min</span>
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-rose-300">Minutos a recuperar este fin de semana: {commitment.deficit}</p>
          </div>
        )}
      </div>

      <h2 className="text-xl font-bold text-slate-200 mb-4">Registro Diario</h2>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {commitment.dailyStats.map((stat) => {
          const isMet = stat.minutes >= commitment.dailyGoalMinutes;
          const isToday = stat.date === todayStr;
          
          return (
            <div 
              key={stat.date} 
              className={`p-4 rounded-xl border ${isMet ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/10'} ${isToday ? 'ring-2 ring-blue-500' : ''}`}
            >
              <p className="text-xs text-slate-400 mb-1">{stat.date}</p>
              <p className={`text-xl font-bold ${isMet ? 'text-emerald-400' : 'text-white'}`}>
                {stat.minutes} <span className="text-xs font-normal text-slate-500">min</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Meta: {commitment.dailyGoalMinutes}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
