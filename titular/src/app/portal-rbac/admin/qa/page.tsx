import React from 'react';
import { 
  ShieldCheck, 
  Filter, 
  MoreVertical,
  Star,
  AlertTriangle,
  User,
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { cn } from '@/lib/utils';

import { NewEvaluationButton } from '@/components/NewEvaluationButton';
import { ExportQAScoresButton } from '@/components/ExportQAScoresButton';

interface QAScore {
  id: number;
  totalScore: number;
  criticalError: boolean;
  auditDate: string;
  auditor: string | null;
  interpreter: {
    name: string;
    campaign: string | null;
  };
}

interface CallSession {
  id: number;
  durationSeconds: number | null;
  interpreter: {
    name: string;
    campaign: string | null;
  };
}

export const dynamic = 'force-dynamic';

async function getQAData() {
  try {
    const [scores, pendingCalls, interpreters] = await Promise.all([
      prisma.qAScore.findMany({
        include: { 
          interpreter: {
            select: { id: true, name: true, campaign: true }
          } 
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.callSession.findMany({
        where: { endedAt: { not: null } },
        include: { 
          interpreter: {
            select: { id: true, name: true, campaign: true }
          } 
        },
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
  const { scores, pendingCalls, interpreters } = await getQAData();

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
          <div className="flex items-baseline gap-2 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">
              {(scores.reduce((s: number, sc: QAScore) => s + Number(sc.totalScore), 0) / (scores.length || 1)).toFixed(1)}%
            </h3>
            <span className="text-xs font-bold text-emerald-400">Target: 95%</span>
          </div>
          <ShieldCheck size={24} className="mt-4 text-emerald-400 relative z-10" />
        </div>

        <div className="bg-gradient-to-br from-amber-900/40 to-slate-900/60 p-6 rounded-3xl border border-amber-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-amber-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-amber-200/70 font-medium tracking-wide uppercase">Critical Errors (MTD)</p>
          <div className="flex items-baseline gap-2 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">
              {scores.filter((sc: QAScore) => sc.criticalError).length}
            </h3>
            <span className="text-xs font-bold text-amber-400">Immediate Action</span>
          </div>
          <AlertTriangle size={24} className="mt-4 text-amber-400 relative z-10" />
        </div>

        <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/60 p-6 rounded-3xl border border-blue-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-blue-200/70 font-medium tracking-wide uppercase">Evaluations Completed</p>
          <div className="flex items-baseline gap-2 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">
              {scores.length}
            </h3>
            <span className="text-xs font-bold text-blue-400">This Month</span>
          </div>
          <User size={24} className="mt-4 text-blue-400 relative z-10" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Evaluations List */}
        <div className="lg:col-span-2 glass rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white tracking-tight">Recent Evaluations</h3>
            <button className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              <Filter size={12} /> Filter
            </button>
          </div>

          <div className="space-y-4">
            {scores.map((score: QAScore) => (
              <div 
                key={score.id}
                className="flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-900/70 rounded-2xl border border-white/5 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border",
                    score.totalScore >= 95 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : score.totalScore >= 85 
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400" 
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}>
                    {score.totalScore}%
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      {score.interpreter?.name || 'Unknown'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Campaign: {score.interpreter?.campaign || 'General'} • Date: {new Date(score.auditDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {score.criticalError && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md border border-red-500/30 animate-pulse">
                      Critical Error
                    </span>
                  )}
                  <button className="text-slate-500 hover:text-white transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            ))}

            {scores.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No evaluations recorded yet. Get started by clicking "New Evaluation".
              </div>
            )}
          </div>
        </div>

        {/* Pending Sessions Queue */}
        <div className="glass rounded-[2.5rem] p-8 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-16 bg-blue-500/5 blur-[50px] rounded-full pointer-events-none" />
          <h3 className="text-xl font-bold text-white tracking-tight mb-6 relative z-10 flex items-center gap-2">
            <Star size={18} className="text-blue-400" /> Audit Queue
          </h3>

          <div className="space-y-4 relative z-10">
            {pendingCalls.map((call: CallSession) => (
              <div 
                key={call.id}
                className="p-4 bg-slate-900/50 hover:bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-2 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{call.interpreter?.name}</h4>
                    <p className="text-[10px] text-slate-500">{call.interpreter?.campaign || 'General'}</p>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">
                    {Math.round((call.durationSeconds || 0) / 60)} min
                  </span>
                </div>
                <button className="w-full mt-2 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 hover:border-transparent rounded-xl text-xs font-bold transition-all">
                  Audit Call
                </button>
              </div>
            ))}

            {pendingCalls.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">
                No calls in queue to audit.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
