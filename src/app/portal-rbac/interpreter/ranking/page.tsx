import React from "react";
import { getRbacRankingData } from "@/app/actions/rbac-data";
import { Trophy, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InterpreterRankingPage() {
  const { rankings, avg, myIdx, myInterpreterId } =
    await getRbacRankingData();

  const monthName = new Date().toLocaleDateString("es-DO", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Trophy size={28} className="text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white capitalize">
            Ranking — {monthName}
          </h1>
          <p className="text-sm text-slate-300">
            Posiciones basadas en horas interpretadas y QA Score
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 border border-amber-500/10">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">
            Tu Posición
          </p>
          <p className="text-3xl font-bold text-amber-400">
            #{myIdx >= 0 ? myIdx + 1 : "—"}
          </p>
          <p className="text-xs text-slate-300 mt-1">
            de {rankings.length} intérpretes
          </p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">
            Tus Horas
          </p>
          <p className="text-3xl font-bold text-white">
            {(myIdx >= 0
              ? rankings[myIdx].totalMinutes / 60
              : 0
            ).toFixed(1)}
          </p>
          <p className="text-xs text-slate-300 mt-1">hrs este mes</p>
        </div>
        <div className="glass rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-slate-300 mb-1 uppercase tracking-wide font-bold">
            Promedio
          </p>
          <p className="text-3xl font-bold text-slate-200">
            {(avg / 60).toFixed(1)}
          </p>
          <p className="text-xs text-slate-300 mt-1">hrs promedio global</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-3xl overflow-hidden border border-white/5">
        <div className="px-6 py-4 border-b border-white/5">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Tabla de Posiciones
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {rankings.map((entry: any, i: number) => {
            const isMe = entry.id === myInterpreterId;
            const medal =
              i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center justify-between px-6 py-4 transition-all",
                  isMe && "bg-blue-500/10 border-l-4 border-blue-500",
                  !isMe && "hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      "text-lg font-bold w-8 text-center",
                      i < 3 ? "text-amber-400" : "text-slate-500"
                    )}
                  >
                    {medal || `#${i + 1}`}
                  </span>
                  <div>
                    <p
                      className={cn(
                        "font-semibold",
                        isMe ? "text-blue-400" : "text-white"
                      )}
                    >
                      {entry.name}{" "}
                      {isMe && (
                        <span className="text-xs">(Tú)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {entry.campaign && (
                        <span className="text-xs text-slate-500">
                          {entry.campaign}
                        </span>
                      )}
                      {entry.qaScore > 0 && (
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full",
                            entry.qaScore >= 90
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-400"
                          )}
                        >
                          QA: {entry.qaScore}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-lg font-bold",
                        isMe ? "text-blue-400" : "text-white"
                      )}
                    >
                      {(entry.totalMinutes / 60).toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400">hrs</p>
                  </div>
                  {/* Goal progress mini-bar */}
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                      <span>
                        <Target size={10} className="inline" /> Meta
                      </span>
                      <span>{entry.goalProgress.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          entry.goalProgress >= 100
                            ? "bg-emerald-400"
                            : i === 0
                              ? "bg-amber-400"
                              : isMe
                                ? "bg-blue-400"
                                : "bg-slate-600"
                        )}
                        style={{ width: `${entry.goalProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {rankings.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-400">
              No hay datos de ranking disponibles para este mes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
