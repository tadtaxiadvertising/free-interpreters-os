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

export const dynamic = 'force-dynamic';

async function getQAScores() {
  try {
    const scores = await prisma.qAScore.findMany({
      orderBy: {
        auditDate: 'desc'
      },
      include: {
        interpreter: true
      }
    });
    return scores;
  } catch (error) {
    console.error('Error fetching QA scores:', error);
    return [];
  }
}

export default async function QAPage() {
  const scores = await getQAScores();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Quality Assurance</h2>
          <p className="text-gray-400">Monitor and evaluate interpreter performance</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all glow">
          <Plus size={20} />
          New Evaluation
        </button>
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
            <h3 className="text-3xl font-bold text-white">{scores.filter(s => s.criticalError).length}</h3>
            <span className="text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-full">This Period</span>
          </div>
          <AlertTriangle size={24} className="mt-4 text-red-500" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Evaluations Pending</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">12</h3>
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Action Needed</span>
          </div>
          <User size={24} className="mt-4 text-blue-400" />
        </div>
      </div>

      {/* Scores List */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Recent Evaluations</h3>
          <div className="flex gap-2">
            <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="py-6 px-8">Interpreter</th>
              <th className="py-6 px-4">Date</th>
              <th className="py-6 px-4">Auditor</th>
              <th className="py-6 px-4">Score</th>
              <th className="py-6 px-4">Status</th>
              <th className="py-6 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {scores.map((score) => (
              <tr key={score.id} className="group hover:bg-white/5 transition-colors">
                <td className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border border-white/5">
                      {score.interpreter.name.charAt(0)}
                    </div>
                    <p className="font-bold text-white">{score.interpreter.name}</p>
                  </div>
                </td>
                <td className="py-6 px-4 text-gray-400 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar size={14} />
                    {score.auditDate.toLocaleDateString()}
                  </span>
                </td>
                <td className="py-6 px-4 text-gray-300 text-sm">
                  {score.auditor || 'System Auto'}
                </td>
                <td className="py-6 px-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-bold",
                      (score.totalScore?.toNumber() ?? 0) >= 90 ? "text-green-400" :
                      (score.totalScore?.toNumber() ?? 0) >= 80 ? "text-yellow-400" : "text-red-400"
                    )}>
                      {score.totalScore?.toString()}%
                    </span>
                    {score.criticalError && <AlertTriangle size={14} className="text-red-500" />}
                  </div>
                </td>
                <td className="py-6 px-4">
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                    score.criticalError ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                  )}>
                    {score.criticalError ? 'Failed' : 'Passed'}
                  </span>
                </td>
                <td className="py-6 px-4 text-right">
                  <button className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {scores.length === 0 && (
          <div className="p-20 text-center">
            <ShieldCheck size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No QA evaluations found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
