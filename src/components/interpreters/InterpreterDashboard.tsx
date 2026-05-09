"use client";

import { useEffect, useState } from "react";
import { getInterpreterCommitment } from "@/app/actions/calendar";
import { Activity, Award, Target, TrendingUp } from "lucide-react";

export default function InterpreterDashboard({ interpreterId }: { interpreterId: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getInterpreterCommitment(interpreterId, new Date().toISOString());
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [interpreterId]);

  if (loading) {
    return <div className="p-6 text-center text-slate-500 animate-pulse">Cargando tu progreso...</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Health Score */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-indigo-100 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Health Score
            </h3>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-5xl font-bold">{data.healthScore}</span>
            <span className="text-indigo-200 mb-1">/ 100</span>
          </div>
          <div className="mt-4 text-sm text-indigo-100 bg-white/10 p-3 rounded-lg backdrop-blur-sm">
            {data.healthScore >= 90 ? "¡Excelente! Estás al día con tus metas." : "Tienes horas pendientes. ¡Tú puedes!"}
          </div>
        </div>

        {/* Weekly Progress */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm col-span-1 md:col-span-2 flex flex-col justify-center">
          <h3 className="font-medium text-slate-700 flex items-center gap-2 mb-6">
            <Target className="w-5 h-5 text-emerald-500" />
            Progreso Semanal
          </h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-500">Minutos Logrados</span>
                <span className="font-medium text-slate-700">{data.totalMinutesWeek} / {data.targetMinutesToDate} mins</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${data.healthScore >= 90 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, (data.totalMinutesWeek / Math.max(1, data.targetMinutesToDate)) * 100)}%` }}
                ></div>
              </div>
            </div>
            
            {data.surplus > 0 && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <Award className="w-5 h-5" />
                <span className="text-sm font-medium">¡Felicidades! Tienes {data.surplus} minutos de sobreproducción esta semana.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekend Recovery Suggestion */}
      {data.recoverySuggestions && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5">
            <TrendingUp className="w-48 h-48 -mt-8 -mr-8" />
          </div>
          <h3 className="text-lg font-semibold text-amber-900 mb-2">¡Aún puedes alcanzar tu meta!</h3>
          <p className="text-amber-700 mb-6 max-w-xl">
            Te faltan {data.deficit} minutos para mantener tu Adherence en verde. Te sugerimos esta distribución para el fin de semana:
          </p>
          
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 text-center">
              <div className="text-sm text-slate-500 mb-1">Sábado</div>
              <div className="text-2xl font-bold text-slate-800">{data.recoverySuggestions.saturdayMinutes} <span className="text-sm font-normal text-slate-500">mins</span></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 text-center">
              <div className="text-sm text-slate-500 mb-1">Domingo</div>
              <div className="text-2xl font-bold text-slate-800">{data.recoverySuggestions.sundayMinutes} <span className="text-sm font-normal text-slate-500">mins</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
