import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getComplianceBoard } from '@/app/actions/calendar';
import Link from 'next/link';
import prisma from '@/lib/prisma';

export default async function AdminCalendarPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const searchParams = await props.searchParams;
  const currentDate = new Date();
  const year = searchParams.year ? parseInt(searchParams.year) : currentDate.getFullYear();
  const month = searchParams.month ? parseInt(searchParams.month) : currentDate.getMonth() + 1;

  const board = await getComplianceBoard(year, month);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return (
    <div className="p-8 max-w-full mx-auto text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Tablero de Cumplimiento
        </h1>
        
        <div className="flex gap-4">
          <Link 
            href={`/admin/calendar?year=${prevYear}&month=${prevMonth}`}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10"
          >
            Mes Anterior
          </Link>
          <span className="px-4 py-2 font-semibold">
            {new Date(year, month - 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
          </span>
          <Link 
            href={`/admin/calendar?year=${nextYear}&month=${nextMonth}`}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors border border-white/10"
          >
            Mes Siguiente
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto bg-black/20 rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4 font-semibold text-slate-300 sticky left-0 bg-slate-900 z-10 border-r border-white/10">
                Intérprete
              </th>
              {board[0]?.days.map((d) => (
                <th key={d.date} className={`p-2 text-center text-xs font-medium ${d.isWeekend ? 'text-slate-500' : 'text-slate-300'}`}>
                  {d.date.split('-')[2]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.map((row) => (
              <tr key={row.interpreter.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 font-medium sticky left-0 bg-slate-900 z-10 border-r border-white/10">
                  {row.interpreter.name}
                </td>
                {row.days.map((d) => {
                  let bgColor = 'bg-slate-800/50';
                  if (d.status === 'Fulfilled') bgColor = 'bg-emerald-500/20 text-emerald-400';
                  else if (d.status === 'Late') bgColor = 'bg-amber-500/20 text-amber-400';
                  else if (d.status === 'No-Show' && !d.isWeekend) bgColor = 'bg-rose-500/20 text-rose-400';
                  
                  return (
                    <td key={d.date} className="p-1">
                      <div 
                        className={`w-full h-8 rounded flex items-center justify-center text-xs font-semibold ${bgColor}`}
                        title={`${d.minutes} min`}
                      >
                        {d.minutes > 0 ? d.minutes : '-'}
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
