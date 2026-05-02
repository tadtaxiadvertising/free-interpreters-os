import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  MoreVertical,
  Plus,
  Star,
  AlertTriangle,
  User,
  Calendar
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { cn } from '@/lib/utils';

import { NewEvaluationButton } from '@/components/NewEvaluationButton';
import { ExportQAScoresButton } from '@/components/ExportQAScoresButton';

export const dynamic = 'force-dynamic';

async function getQAData() {
  try {
    const [scores, pendingCalls, interpreters] = await Promise.all([
      prisma.qAScore.findMany({
        include: { interpreter: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.callSession.findMany({
        where: { endedAt: { not: null } },
        include: { interpreter: true },
        orderBy: { startedAt: 'desc' },
        take: 10
      }),
      prisma.interpreter.findMany({
        where: { status: 'Activo' },
        select: { id: true, name: true, externalId: true },
        orderBy: { name: 'asc' }
      })
    ]);

    return { 
      scores: JSON.parse(JSON.stringify(scores)), 
      pendingCalls: JSON.parse(JSON.stringify(pendingCalls)),
      interpreters: JSON.parse(JSON.stringify(interpreters))
    };
  } catch (error) {
    console.error('Error fetching QA data from DB:', error);
    return { scores: [], pendingCalls: [], interpreters: [] };
  }
}

export default async function QAPage() {
  const { scores, pendingCalls } = await getQAData();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Quality Assurance</h2>
          <p className="text-gray-400">Monitor and evaluate interpreter performance</p>
        </div>
        <div className="flex gap-3">
          <ExportQAScoresButton data={scores} />
          <NewEvaluationButton interpreters={interpreters} />
        </div>
      </header>


      {/* QA Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/60 p-6 rounded-3xl border border-emerald-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-emerald-200/70 font-medium tracking-wide uppercase">Avg. Quality Score</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">94.2%</h3>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">+1.2%</span>
          </div>
          <div className="mt-4 flex gap-1 relative z-10">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} className="text-yellow-500 fill-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />)}
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-rose-900/40 to-slate-900/60 p-6 rounded-3xl border border-rose-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-rose-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-rose-200/70 font-medium tracking-wide uppercase">Critical Errors</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">{scores.filter((s: any) => s.criticalError).length}</h3>
            <span className="text-xs font-bold text-rose-400 bg-rose-400/10 px-3 py-1 rounded-full border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]">This Period</span>
          </div>
          <AlertTriangle size={24} className="mt-4 text-rose-400 relative z-10" />
        </div>
        
        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 p-6 rounded-3xl border border-indigo-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
          <div className="absolute top-4 right-4">
            <div className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-ping shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
          </div>
          <p className="text-sm text-indigo-200/70 font-medium tracking-wide uppercase">Calls Awaiting Audit</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">{pendingCalls.length}+</h3>
            <span className="text-xs font-bold text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.2)]">Live Feed</span>
          </div>
          <User size={24} className="mt-4 text-indigo-400 relative z-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Pending Calls - 1/3 width */}
        <div className="xl:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Pending Audit</h3>
            <span className="text-xs text-blue-400 hover:underline cursor-pointer">View all sessions</span>
          </div>
          
          <div className="space-y-4">
            {pendingCalls.map((call: any) => (
              <div key={call.id} className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all duration-300 group backdrop-blur-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-bold border border-white/5 shadow-inner">
                      {call.interpreter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm group-hover:text-indigo-400 transition-colors">{call.interpreter.name}</p>
                      <p className="text-slate-500 text-xs">{call.interpreter.campaign || 'No Campaign'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg font-mono font-medium">
                    {Math.floor((call.durationSeconds || 0) / 60)}m {Math.floor((call.durationSeconds || 0) % 60)}s
                  </span>
                </div>
                <button className="w-full py-2 bg-indigo-600/10 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white rounded-xl text-xs font-bold transition-all duration-300 border border-indigo-500/20 group-hover:border-transparent">
                  Audit Now
                </button>
              </div>
            ))}
            
            {pendingCalls.length === 0 && (
              <div className="bg-slate-900/20 p-8 rounded-2xl border border-slate-800 border-dashed text-center">
                <ShieldCheck size={32} className="mx-auto text-slate-700 mb-2" />
                <p className="text-slate-500 text-sm font-medium">No calls waiting for audit.</p>
              </div>
            )}
          </div>
        </div>

        {/* Scores List - 2/3 width */}
        <div className="xl:col-span-2">
          <div className="glass rounded-3xl overflow-visible border border-white/5">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white">Recent Evaluations</h3>
              <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white transition-colors">
                <Filter size={18} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 text-[10px] uppercase tracking-wider border-b border-white/5 bg-white/[0.01]">
                    <th className="py-4 px-8 font-semibold">Interpreter</th>
                    <th className="py-4 px-4 font-semibold">Date</th>
                    <th className="py-4 px-4 font-semibold">Score</th>
                    <th className="py-4 px-4 font-semibold">Status</th>
                    <th className="py-4 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {scores.map((score: any) => (
                    <tr key={score.id} className="group hover:bg-white/5 transition-all duration-300">
                      <td className="py-5 px-8">
                        <p className="font-bold text-white text-sm group-hover:text-indigo-400 transition-colors">{score.interpreter.name}</p>
                        <p className="text-slate-500 text-[10px]">Auditor: {score.auditor || 'System'}</p>
                      </td>
                      <td className="py-5 px-4 text-slate-400 text-xs font-medium" suppressHydrationWarning>
                        {new Date(score.auditDate).toLocaleDateString()}
                      </td>
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-sm tracking-tight",
                            parseFloat(score.totalScore || 0) >= 90 ? "text-emerald-400" :
                            parseFloat(score.totalScore || 0) >= 80 ? "text-amber-400" : "text-rose-400"
                          )}>
                            {score.totalScore?.toString()}%
                          </span>
                          {score.criticalError && <AlertTriangle size={14} className="text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]" />}
                        </div>
                      </td>
                      <td className="py-5 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                          score.criticalError ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        )}>
                          {score.criticalError ? 'Failed' : 'Passed'}
                        </span>
                      </td>
                      <td className="py-5 px-4 text-right">
                        <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {scores.length === 0 && (
              <div className="p-20 text-center">
                <ShieldCheck size={48} className="mx-auto text-gray-700 mb-4" />
                <p className="text-gray-500">No QA evaluations found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
