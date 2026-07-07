"use client";

import { useState, useTransition } from "react";
import { registerPerformanceMetrics } from "@/app/actions/performance-metrics";
import { Check, Target, Clock, AlertTriangle, Activity, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface DailyPerformance {
  date: string;
  isWeekend: boolean;
  logMinutes: number;
  sessionMinutes: number;
  totalMinutes: number;
  progressPercent: number;
  statusColor: string;
  dailyGoal: number;
}

interface PerformanceData {
  interpreterId: number;
  interpreterName: string;
  interpreterExternalId: string | null;
  monthlyGoal: number;
  dailyGoal: number;
  totalInterpreted: number;
  monthlyProgressPercent: number;
  history: DailyPerformance[];
}

export function PerformanceHistoryPanel({ data }: { data: PerformanceData }) {
  const [isPending, startTransition] = useTransition();
  const [newGoal, setNewGoal] = useState<string>(data.monthlyGoal.toString());

  // Manejo de estado visual con react-hot-toast
  const handleUpdateGoal = () => {
    const parsedGoal = parseInt(newGoal, 10);
    if (isNaN(parsedGoal) || parsedGoal < 100) {
      toast.error("Por favor ingresa una meta válida (mínimo 100)");
      return;
    }

    startTransition(async () => {
      const result = await registerPerformanceMetrics({
        interpreterId: data.interpreterId,
        monthlyGoal: parsedGoal
      });

      if (result.success) {
        toast.success("Meta mensual actualizada exitosamente");
      } else {
        toast.error(result.error || "Error al actualizar la meta");
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* TARJETAS RESUMEN - META MENSUAL Y DIARIA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5"><Target size={120} /></div>
          <p className="text-sm text-gray-500 font-medium">Meta Mensual (Progreso)</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">{data.totalInterpreted}</h3>
            <span className="text-xl text-gray-400">/ {data.monthlyGoal} mins</span>
          </div>
          
          <div className="mt-4 w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                data.monthlyProgressPercent >= 100 ? "bg-green-500" : 
                data.monthlyProgressPercent >= 50 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${data.monthlyProgressPercent}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 font-medium">{data.monthlyProgressPercent}% completado</p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5"><Activity size={120} /></div>
          <p className="text-sm text-gray-500 font-medium">Meta Diaria Calculada</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">{data.dailyGoal}</h3>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-full">mins/día</span>
          </div>
          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            Calculado automáticamente basado en un promedio estándar de 22 días laborables.
          </p>
        </div>

        <div className="glass p-6 rounded-3xl border border-white/5 flex flex-col justify-center">
          <p className="text-sm text-gray-500 font-medium mb-3">Actualizar Meta Mensual</p>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={newGoal} 
              onChange={(e) => setNewGoal(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-2 w-full focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button 
              onClick={handleUpdateGoal}
              disabled={isPending}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isPending ? <RefreshCw className="animate-spin w-5 h-5" /> : <Check className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* VISTA ESTRUCTURADA TIPO TABLA: HISTORIAL PROFESIONAL */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" />
              Historial de Rendimiento
            </h3>
            <p className="text-sm text-gray-500 mt-1">Registros consolidados: Logs estáticos y Telemetría en tiempo real.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5 bg-white/[0.02]">
                <th className="py-4 px-6 font-medium">Fecha</th>
                <th className="py-4 px-6 font-medium text-center">CSV / Manual</th>
                <th className="py-4 px-6 font-medium text-center">Telemetría (Realtime)</th>
                <th className="py-4 px-6 font-medium text-center">Total Día</th>
                <th className="py-4 px-6 font-medium text-center">Estado de Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.history.map((day, idx) => (
                <tr key={idx} className={cn("transition-colors hover:bg-white/[0.02]", day.isWeekend && "bg-slate-900/30")}>
                  <td className="py-4 px-6 text-sm font-medium text-slate-300">
                    {day.date} {day.isWeekend && <span className="ml-2 text-xs text-slate-500">(Fin de semana)</span>}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400 text-center">{day.logMinutes}m</td>
                  <td className="py-4 px-6 text-sm text-slate-400 text-center">{day.sessionMinutes}m</td>
                  <td className="py-4 px-6 text-center">
                    <span className="font-bold text-white">{day.totalMinutes}m</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold flex items-center justify-center gap-1 w-fit mx-auto",
                      day.statusColor
                    )}>
                      {day.progressPercent}% 
                      {day.progressPercent < 50 && !day.isWeekend && <AlertTriangle className="w-3 h-3 ml-1" />}
                    </span>
                  </td>
                </tr>
              ))}
              {data.history.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    No hay registros de rendimiento en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
