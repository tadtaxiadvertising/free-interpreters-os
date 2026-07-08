'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoalProgressWidgetProps {
  monthlyGoal: number;
  q1Minutes: number;
  q2Minutes: number;
  isQ1: boolean;
  tariffPerMinute: number;
}

export function GoalProgressWidget({
  monthlyGoal,
  q1Minutes,
  q2Minutes,
  isQ1,
  tariffPerMinute,
}: GoalProgressWidgetProps) {
  const currentMinutes = isQ1 ? q1Minutes : q1Minutes + q2Minutes;
  const targetMinutes = isQ1 ? monthlyGoal / 2 : monthlyGoal;
  const percentage = Math.min(Math.round((currentMinutes / targetMinutes) * 100), 100);
  
  const isGoalMet = currentMinutes >= targetMinutes;

  const baseRate = Math.round(tariffPerMinute * 60);
  const penalizedRate = Math.max(0, baseRate - 50);

  return (
    <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 backdrop-blur-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Progreso de Meta {isQ1 ? 'Quincenal (Q1)' : 'Mensual (Acumulado)'}
        </h3>
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium",
          isGoalMet 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
        )}>
          {isGoalMet ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Tarifa Completa Asegurada
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Tarifa Reducida Temporal
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm font-medium mb-2 text-slate-300">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-slate-400" />
            {currentMinutes} / {targetMinutes} min
          </span>
          <span className="text-white">{percentage}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out relative",
              isGoalMet ? "bg-gradient-to-r from-emerald-600 to-emerald-400" : "bg-gradient-to-r from-amber-600 to-amber-400"
            )}
            style={{ width: `${percentage}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        {isQ1 ? (
          isGoalMet ? (
            `¡Excelente! Has alcanzado tu meta de la primera quincena. Tu tarifa base está asegurada a $${baseRate}/h.`
          ) : (
            `Alerta: Si no alcanzas los ${targetMinutes} minutos antes del cierre de quincena, tu pago base se calculará a $${penalizedRate}/h. ¡Aún puedes restaurarlo a $${baseRate}/h en la segunda quincena si cumples tu meta mensual!`
          )
        ) : (
          isGoalMet ? (
            `¡Felicidades! Has cumplido tu meta mensual. Recibirás tu tarifa completa de $${baseRate}/h y el reembolso de cualquier penalidad de tu quincena anterior.`
          ) : (
            `¡Estás a ${targetMinutes - currentMinutes} minutos de cumplir tu meta mensual, recuperar tu tarifa completa de $${baseRate}/h y recibir el reembolso de tu quincena anterior!`
          )
        )}
      </p>
    </div>
  );
}
