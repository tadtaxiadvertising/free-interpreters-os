import React from "react";
import { getRbacInterpreterDashboard } from "@/app/actions/rbac-data";
import {
  Clock,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InterpreterDashboardPage() {
  const data = await getRbacInterpreterDashboard();

  if (!data.interpreter) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass p-10 rounded-3xl text-center max-w-lg border border-white/5">
          <div className="w-20 h-20 bg-orange-500/10 rounded-3xl flex items-center justify-center text-orange-400 mx-auto mb-6 border border-orange-500/20">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-3xl font-black text-white mb-4">
            Perfil no vinculado
          </h2>
          <p className="text-slate-300">
            Tu cuenta RBAC no está vinculada a un perfil de intérprete activo.
            Contacta al administrador.
          </p>
        </div>
      </div>
    );
  }

  const {
    interpreter,
    todayMinutes,
    mtdMinutes,
    dailyGoal,
    monthlyGoal,
    mtdEarnings,
    latestQa,
  } = data;

  const mtdProgress = Math.min((mtdMinutes / (monthlyGoal / 60)) * 100, 100);
  const todayProgress = Math.min((todayMinutes / dailyGoal) * 100, 100);
  const isQaExcellent = latestQa >= 95;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900/50 to-slate-900 border border-indigo-500/20 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 p-32 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Hola, {interpreter.name}
              </h2>
              {isQaExcellent && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  Top Tier QA ✨
                </span>
              )}
            </div>
            <p className="text-slate-200 font-medium">
              {interpreter.languageA} ↔ {interpreter.languageB}
              {interpreter.campaign && (
                <span className="ml-3 text-indigo-300">
                  • {interpreter.campaign}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                interpreter.realtimeStatus === "Online"
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  : interpreter.realtimeStatus === "Busy"
                    ? "bg-orange-500"
                    : "bg-gray-600"
              )}
            />
            <span className="text-sm text-slate-300 font-medium">
              {interpreter.realtimeStatus || "Offline"}
            </span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* MTD Progress */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm text-white font-semibold mb-1">
                  Horas MTD
                </p>
                <p className="text-3xl font-bold text-white">
                  <span suppressHydrationWarning>
                    {(mtdMinutes / 60).toFixed(1)}
                  </span>
                  <span className="text-lg text-slate-300">
                    {" "}
                    / {Math.round(monthlyGoal / 60)}
                  </span>
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
            <p
              suppressHydrationWarning
              className="text-xs text-slate-200 mt-2 text-right font-medium"
            >
              {mtdProgress.toFixed(1)}% de la meta mensual
            </p>
          </div>

          {/* QA Score */}
          <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-white font-semibold">QA Score</p>
              <div
                className={cn(
                  "p-2 rounded-xl",
                  isQaExcellent
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-slate-800 text-slate-200"
                )}
              >
                <ShieldCheck size={20} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "text-4xl font-bold",
                  isQaExcellent
                    ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    : "text-white"
                )}
              >
                {latestQa}%
              </p>
              {isQaExcellent && (
                <span className="text-sm font-medium text-emerald-400">
                  ¡Excelente!
                </span>
              )}
            </div>
          </div>

          {/* Earnings */}
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
              <span className="text-slate-300 text-sm font-medium">
                ({(mtdMinutes / 60).toFixed(1)} hrs)
              </span>
            </div>
            <p className="text-xs text-slate-200 mt-2 font-medium">
              Tarifa: RD$
              {(interpreter.tariffPerMinute * 60).toFixed(2)}/hr
            </p>
          </div>
        </div>
      </div>

      {/* Daily Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass rounded-3xl p-8 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 bg-emerald-500/5 blur-[50px] rounded-full -mr-8 -mt-8 pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                <TrendingUp size={22} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Meta Diaria
              </h3>
            </div>
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md uppercase tracking-wider border border-emerald-500/20">
              Daily Target
            </span>
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm text-slate-400 font-medium mb-1">
                  Producción de hoy
                </p>
                <p className="text-3xl font-bold text-white">
                  <span suppressHydrationWarning>{todayMinutes}</span>
                  <span className="text-lg text-slate-400">
                    {" "}
                    / {dailyGoal} min
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400 font-medium mb-1">
                  Restante
                </p>
                <p className="text-xl font-bold text-emerald-400">
                  {Math.max(0, dailyGoal - todayMinutes)} min
                </p>
              </div>
            </div>

            <div className="w-full h-4 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full relative transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                style={{ width: `${todayProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            <div className="flex justify-between mt-3">
              <p className="text-xs text-slate-500 font-medium">
                {todayProgress.toFixed(1)}% completado
              </p>
              {todayProgress >= 100 && (
                <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> ¡Meta lograda!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live Call Status */}
        <div className="glass rounded-3xl p-8 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 bg-blue-500/5 blur-[50px] rounded-full -mr-8 -mt-8 pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                <Phone size={22} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Estado de Llamada
              </h3>
            </div>
            {data.activeCall && (
              <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md uppercase tracking-wider border border-orange-500/20 animate-pulse">
                En Llamada
              </span>
            )}
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center py-6">
            {data.activeCall ? (
              <>
                <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                  <Phone size={32} className="text-orange-400" />
                </div>
                <p className="text-lg font-bold text-orange-400">
                  Llamada activa
                </p>
                <p className="text-sm text-slate-400">
                  Iniciada:{" "}
                  {new Date(data.activeCall.startedAt).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                  <Phone size={32} className="text-slate-600" />
                </div>
                <p className="text-lg font-bold text-slate-400">
                  Sin llamada activa
                </p>
                <p className="text-sm text-slate-500">Disponible</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
