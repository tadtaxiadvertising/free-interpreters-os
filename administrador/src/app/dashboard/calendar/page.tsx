import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/actions';
import { getInterpreterCommitment } from '@/app/actions/calendar';
import { Flame, Trophy, TrendingUp, AlertCircle, CalendarDays } from 'lucide-react';

export default async function InterpreterCalendarPage() {
  const userData = await getCurrentUser();

  if (!userData) {
    redirect('/login');
  }

  const profile = userData.profile;

  if (!profile || !profile.interpreterId) {
    return <div className="p-8 text-white">Interpreter profile not found.</div>;
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo' }).format(new Date());
  const commitment = await getInterpreterCommitment(profile.interpreterId, todayStr);

  const tariff = commitment.interpreter.tariffPerMinute ? Number(commitment.interpreter.tariffPerMinute) : 0;
  const recoveryMoney = commitment.deficit * tariff;

  const formatMinutes = (mins: number) => new Intl.NumberFormat('en-US').format(mins);
  const formatMoney = (amount: number) => `RD$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)}`;

  // Gamification states
  const isOverachieving = commitment.healthScore > 100;

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/20 rounded-xl">
          <CalendarDays className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
          Mi Calendario de Metas
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Weekly Progress Card */}
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          {isOverachieving && (
            <div className="absolute top-0 right-0 p-4 animate-pulse">
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                <Trophy className="w-3 h-3" /> Sobreproducción
              </span>
            </div>
          )}
          
          <div className="relative z-10">
            <h2 className="text-lg font-semibold text-slate-300 mb-2 flex items-center gap-2">
              Progreso Semanal
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </h2>
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-white tracking-tight">{formatMinutes(commitment.totalMinutesWeek)}</span>
              <span className="text-slate-400 mb-2 font-medium">/ {formatMinutes(commitment.targetMinutesToDate)} min esperados</span>
            </div>
            
            <div className="mt-5 h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  isOverachieving ? 'bg-gradient-to-r from-emerald-400 to-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.8)]' :
                  commitment.healthScore >= 100 ? 'bg-emerald-500' : 
                  commitment.healthScore >= 80 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, commitment.healthScore)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-3">
              <p className="text-sm font-medium text-slate-400">Health Score</p>
              <p className={`text-lg font-bold ${
                isOverachieving ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                commitment.healthScore >= 100 ? 'text-emerald-400' : 
                commitment.healthScore >= 80 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {commitment.healthScore}%
              </p>
            </div>
          </div>
        </div>

        {/* Motivation & Recovery Card */}
        {commitment.deficit > 0 ? (
          <div className="bg-gradient-to-br from-slate-900 to-rose-950/20 border border-rose-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-rose-500/40 transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertCircle className="w-24 h-24 text-rose-500" />
            </div>
            <h2 className="text-lg font-bold text-rose-400 mb-2">¡Asegura tu Nómina!</h2>
            <p className="text-sm text-slate-300 mb-5 leading-relaxed">
              El fin de semana es tu oportunidad. Recupera tus <span className="font-bold text-rose-400">{formatMinutes(commitment.deficit)} minutos</span> pendientes y asegura <span className="font-bold text-emerald-400">{formatMoney(recoveryMoney)} extra</span> en tu próximo pago.
            </p>
            
            {commitment.recoverySuggestions && (
              <div className="space-y-3 relative z-10">
                <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl flex justify-between items-center border border-white/5">
                  <span className="text-slate-200 font-medium">Sábado</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">+{formatMinutes(commitment.recoverySuggestions.saturdayMinutes)} min</span>
                </div>
                <div className="bg-black/40 backdrop-blur-sm p-4 rounded-xl flex justify-between items-center border border-white/5">
                  <span className="text-slate-200 font-medium">Domingo</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">+{formatMinutes(commitment.recoverySuggestions.sundayMinutes)} min</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-center items-center text-center group hover:border-emerald-500/60 transition-all duration-300">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">¡Racha Perfecta!</h2>
            <p className="text-slate-300 max-w-[250px]">
              Estás al día con tus metas. Todo lo que hagas ahora es <span className="text-emerald-400 font-bold">ganancia extra pura</span>. ¡Sigue así!
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-6 mt-10">
        <h2 className="text-xl font-bold text-slate-200">Registro Diario</h2>
        <span className="text-xs font-medium text-slate-500 bg-slate-800 px-2 py-1 rounded-md">Meta: {formatMinutes(commitment.dailyGoalMinutes)} min/día</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {commitment.dailyStats.map((stat) => {
          const isOverproducing = stat.minutes >= (commitment.dailyGoalMinutes * 1.1);
          const isMet = stat.minutes >= commitment.dailyGoalMinutes;
          const isToday = stat.date === todayStr;
          
          return (
            <div 
              key={stat.date} 
              className={`relative p-5 rounded-2xl border transition-all duration-300
                ${isOverproducing 
                  ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                  : isMet 
                    ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40' 
                    : 'bg-slate-900/50 border-white/5 hover:border-white/10'
                } 
                ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950' : ''}
              `}
            >
              {isOverproducing && (
                <div className="absolute -top-3 -right-3">
                  <div className="bg-amber-500 text-amber-950 p-1.5 rounded-full shadow-lg shadow-amber-500/20 animate-pulse">
                    <Flame className="w-4 h-4 fill-amber-950" />
                  </div>
                </div>
              )}
              
              <p className={`text-xs font-medium mb-3 ${isMet ? 'text-slate-300' : 'text-slate-500'}`}>
                {new Date(stat.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}
              </p>
              
              <div className="flex items-baseline gap-1">
                <p className={`text-3xl font-black tracking-tight ${
                  isOverproducing ? 'text-amber-400' : 
                  isMet ? 'text-emerald-400' : 'text-white'
                }`}>
                  {formatMinutes(stat.minutes)}
                </p>
                <span className={`text-sm font-medium ${isMet ? 'text-emerald-500/70' : 'text-slate-600'}`}>
                  min
                </span>
              </div>

              {isMet && !isOverproducing && (
                <div className="mt-3 inline-block bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  META LOGRADA
                </div>
              )}
              {isOverproducing && (
                <div className="mt-3 inline-block bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                  FUEGO 🔥
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
