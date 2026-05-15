"use client";

import { useState, useEffect } from "react";
import { getComplianceBoard } from "@/app/actions/calendar";
import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react";
import { ComplianceBoardRow, ComplianceDay } from "@/lib/types";

export default function ComplianceBoard() {
  const [boardData, setBoardData] = useState<ComplianceBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    async function load() {
      try {
        const data = await getComplianceBoard(currentYear, currentMonth);
        setBoardData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentYear, currentMonth]);

  if (loading) {
    return <div className="flex justify-center p-8"><span className="animate-pulse">Cargando Compliance Board...</span></div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Smart Compliance Board
        </h2>
        <p className="text-sm text-slate-500 mt-1">Supervisión inteligente de compromiso por intérprete.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Intérprete</th>
              {boardData[0]?.days.map((d: ComplianceDay, i: number) => (
                <th key={i} className={`px-2 py-3 font-medium text-center min-w-[40px] ${d.isWeekend ? 'bg-indigo-50/50' : ''}`}>
                  {d.date.split('-')[2]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {boardData.map((row) => (
              <tr key={row.interpreter.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-100 whitespace-nowrap">
                  {row.interpreter.name}
                  <div className="text-xs text-slate-500 font-normal">{row.interpreter.shiftStart} - {row.interpreter.shiftEnd}</div>
                </td>
                {row.days.map((d: ComplianceDay, i: number) => {
                  let bgColor = "bg-slate-50";
                  let Icon = null;
                  
                  if (d.status === "Fulfilled") {
                    bgColor = "bg-emerald-100 text-emerald-700";
                    Icon = CheckCircle;
                  } else if (d.status === "Late") {
                    bgColor = "bg-amber-100 text-amber-700";
                    Icon = Clock;
                  } else if (d.status === "No-Show") {
                    bgColor = "bg-rose-100 text-rose-700";
                    Icon = XCircle;
                  } else if (d.isWeekend) {
                    bgColor = "bg-slate-50/50";
                  }

                  return (
                    <td key={i} className={`px-1 py-2 text-center border-l border-slate-50 ${d.isWeekend ? 'bg-indigo-50/10' : ''}`}>
                      <div className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center ${bgColor} transition-colors`} title={`${d.status} - ${d.minutes} mins`}>
                        {d.minutes > 0 ? (
                          <span className="text-xs font-semibold">{d.minutes}</span>
                        ) : (
                          Icon && <Icon className="w-4 h-4 opacity-70" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
