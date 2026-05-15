import React from 'react';
import Link from 'next/link';
import { 
  Clock, 
  Filter, 
  MoreVertical,
  Plus,
  Calendar,
  Zap,
  PhoneCall
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { cn } from '@/lib/utils';

interface ProductionLog {
  id: number;
  interpretedMinutes: number | null;
  callsAttended: number | null;
  adherence: any;  
  date: Date;
  interpreter: { name: string | null } | null;
}

export const dynamic = 'force-dynamic';

async function getProductionLogs(): Promise<ProductionLog[]> {
  try {
      const logs = await prisma.productionLog.findMany({
        orderBy: {
          date: 'desc'
        },
        include: {
          interpreter: {
            select: { id: true, name: true, campaign: true }
          }
        }
      });
    return logs;
  } catch (error) {
    console.error('Error fetching production logs:', error);
    return [];
  }
}

export default async function ProductionPage() {
  const logs = await getProductionLogs();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Production Logs</h2>
          <p className="text-gray-400">Daily connection metrics and call statistics</p>
        </div>
        <Link 
          href="/admin/production/manual"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all glow"
        >
          <Plus size={20} />
          Log Session
        </Link>
      </header>

      {/* Production Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Avg. Adherence</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">92.5%</h3>
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Optimal</span>
          </div>
          <Zap size={24} className="mt-4 text-blue-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Billed Minutes</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">
              {logs.reduce((acc: number, log: ProductionLog) => acc + (log.interpretedMinutes || 0), 0).toLocaleString()}
            </h3>
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Total</span>
          </div>
          <Clock size={24} className="mt-4 text-green-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Calls Attended</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">
              {logs.reduce((acc: number, log: ProductionLog) => acc + (log.callsAttended || 0), 0).toLocaleString()}
            </h3>
            <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full">Total</span>
          </div>
          <PhoneCall size={24} className="mt-4 text-purple-400" />
        </div>
      </div>

      {/* Logs List */}
      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Activity History</h3>
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
              <th className="py-6 px-4">Minutes</th>
              <th className="py-6 px-4">Calls</th>
              <th className="py-6 px-4">Adherence</th>
              <th className="py-6 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {logs.map((log) => (
              <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                <td className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 font-bold border border-white/5">
                      {log.interpreter?.name?.charAt(0) || '?'}
                    </div>
                    <p className="font-bold text-white">{log.interpreter?.name || 'Unknown'}</p>
                  </div>
                </td>
                <td className="py-6 px-4 text-gray-400 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar size={14} />
                    {log.date.toLocaleDateString()}
                  </span>
                </td>
                <td className="py-6 px-4 text-white font-mono">
                  {log.interpretedMinutes}m
                </td>
                <td className="py-6 px-4 text-gray-300">
                  {log.callsAttended}
                </td>
                <td className="py-6 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full",
                          (log.adherence?.toNumber() ?? 0) >= 90 ? "bg-green-500" :
                          (log.adherence?.toNumber() ?? 0) >= 80 ? "bg-yellow-500" : "bg-red-500"
                        )}
                        style={{ width: `${log.adherence?.toNumber() ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-white">{log.adherence?.toString()}%</span>
                  </div>
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

        {logs.length === 0 && (
          <div className="p-20 text-center">
            <Clock size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No production logs found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
