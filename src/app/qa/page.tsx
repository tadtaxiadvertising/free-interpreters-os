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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const [scoresRes, pendingRes] = await Promise.all([
      fetch(`${apiUrl}/api/qa`, { cache: 'no-store' }),
      fetch(`${apiUrl}/api/qa/pending`, { cache: 'no-store' })
    ]);

    const scores = scoresRes.ok ? await scoresRes.json() : [];
    const pendingCalls = pendingRes.ok ? await pendingRes.json() : [];

    return { scores, pendingCalls };
  } catch (error) {
    console.error('Error fetching QA data:', error);
    return { scores: [], pendingCalls: [] };
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
          <NewEvaluationButton />
        </div>
      </header>


      {/* QA Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Avg. Quality Score</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">94.2%</h3>
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">+1.2%</span>
          </div>
          <div className="mt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} className="text-yellow-500 fill-yellow-500" />)}
          </div>
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Critical Errors</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">{scores.filter((s: any) => s.criticalError).length}</h3>
            <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full">This Period</span>
          </div>
          <AlertTriangle size={24} className="mt-4 text-red-500" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" />
          </div>
          <p className="text-sm text-gray-500 font-medium">Calls Awaiting Audit</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">{pendingCalls.length}+</h3>
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Live Feed</span>
          </div>
          <User size={24} className="mt-4 text-blue-400" />
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
              <div key={call.id} className="glass p-5 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border border-white/5">
                      {call.interpreter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{call.interpreter.name}</p>
                      <p className="text-gray-500 text-xs">{call.interpreter.campaign || 'No Campaign'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-white/5 text-gray-400 px-2 py-1 rounded-lg">
                    {Math.floor((call.durationSeconds || 0) / 60)}m {Math.floor((call.durationSeconds || 0) % 60)}s
                  </span>
                </div>
                <button className="w-full py-2 bg-blue-600/10 group-hover:bg-blue-600 text-blue-400 group-hover:text-white rounded-xl text-xs font-bold transition-all border border-blue-500/20 group-hover:border-transparent">
                  Audit Now
                </button>
              </div>
            ))}
            
            {pendingCalls.length === 0 && (
              <div className="glass p-8 rounded-2xl border border-white/5 text-center">
                <ShieldCheck size={32} className="mx-auto text-gray-700 mb-2" />
                <p className="text-gray-500 text-sm">No calls waiting for audit.</p>
              </div>
            )}
          </div>
        </div>

        {/* Scores List - 2/3 width */}
        <div className="xl:col-span-2">
          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white">Recent Evaluations</h3>
              <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                <Filter size={18} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5 bg-white/[0.01]">
                    <th className="py-4 px-8">Interpreter</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4">Score</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {scores.map((score: any) => (
                    <tr key={score.id} className="group hover:bg-white/5 transition-colors">
                      <td className="py-5 px-8">
                        <p className="font-bold text-white text-sm">{score.interpreter.name}</p>
                        <p className="text-gray-500 text-[10px]">Auditor: {score.auditor || 'System'}</p>
                      </td>
                      <td className="py-5 px-4 text-gray-400 text-xs" suppressHydrationWarning>
                        {new Date(score.auditDate).toLocaleDateString()}
                      </td>
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-sm",
                            parseFloat(score.totalScore || 0) >= 90 ? "text-green-400" :
                            parseFloat(score.totalScore || 0) >= 80 ? "text-yellow-400" : "text-red-400"
                          )}>
                            {score.totalScore?.toString()}%
                          </span>
                          {score.criticalError && <AlertTriangle size={14} className="text-red-500" />}
                        </div>
                      </td>
                      <td className="py-5 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                          score.criticalError ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"
                        )}>
                          {score.criticalError ? 'Failed' : 'Passed'}
                        </span>
                      </td>
                      <td className="py-5 px-4 text-right">
                        <button className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
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
