import React from 'react';
import Link from 'next/link';
import { Clock, Plus, Calendar, Zap, PhoneCall } from 'lucide-react';
import prisma from '@/lib/prisma';
import { cn } from '@/lib/utils';
import { ProductionLogActions } from '@/components/admin/ProductionLogActions';
import { ProductionLogControls } from '@/components/admin/ProductionLogControls';

interface ProductionLog {
  id: number;
  interpreterId: number | null;
  interpretedMinutes: number | null;
  callsAttended: number | null;
  adherence: any;
  date: Date;
  status: string;
  observaciones: string | null;
  interpreter: { id: number; name: string | null; campaign: string | null } | null;
}

type ProductionSearchParams = Promise<{ search?: string; filter?: string }>;

export const dynamic = 'force-dynamic';

async function getProductionLogs(searchParams: { search?: string; filter?: string }): Promise<ProductionLog[]> {
  const search = searchParams.search?.trim();
  const filter = searchParams.filter?.trim();

  try {
    const logs = await prisma.productionLog.findMany({
      where: {
        ...(filter && filter !== 'all' ? { status: filter } : {}),
        ...(search ? {
          OR: [
            { status: { contains: search, mode: 'insensitive' } },
            { campaign: { contains: search, mode: 'insensitive' } },
            { interpreter: { name: { contains: search, mode: 'insensitive' } } },
            { interpreter: { externalId: { contains: search, mode: 'insensitive' } } },
          ],
        } : {}),
      },
      orderBy: { date: 'desc' },
      include: { interpreter: { select: { id: true, name: true, campaign: true } } },
    });
    return logs;
  } catch (error) {
    console.error('Error fetching production logs:', error);
    return [];
  }
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ProductionPage({ searchParams }: { searchParams: ProductionSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const logs = await getProductionLogs(resolvedSearchParams);
  const avgAdherence = logs.length
    ? logs.reduce((acc, log) => acc + Number(log.adherence ?? 0), 0) / logs.length
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Production Logs</h2>
          <p className="text-gray-400">Daily connection metrics and call statistics</p>
        </div>
        <Link href="/admin/production/manual" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold transition-all glow">
          <Plus size={20} />
          Log Session
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Avg. Adherence</p>
          <div className="flex items-center gap-3 mt-2"><h3 className="text-3xl font-bold text-white">{avgAdherence.toFixed(1)}%</h3><span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Optimal</span></div>
          <Zap size={24} className="mt-4 text-blue-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Billed Minutes</p>
          <div className="flex items-center gap-3 mt-2"><h3 className="text-3xl font-bold text-white">{logs.reduce((acc, log) => acc + (log.interpretedMinutes || 0), 0).toLocaleString()}</h3><span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Total</span></div>
          <Clock size={24} className="mt-4 text-green-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Calls Attended</p>
          <div className="flex items-center gap-3 mt-2"><h3 className="text-3xl font-bold text-white">{logs.reduce((acc, log) => acc + (log.callsAttended || 0), 0).toLocaleString()}</h3><span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full">Total</span></div>
          <PhoneCall size={24} className="mt-4 text-purple-400" />
        </div>
      </div>

      <div className="glass rounded-3xl overflow-visible">
        <div className="p-6 border-b border-white/5 space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-white">Activity History</h3></div>
          <ProductionLogControls />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5"><th className="py-6 px-8">Interpreter</th><th className="py-6 px-4">Date</th><th className="py-6 px-4">Minutes</th><th className="py-6 px-4">Calls</th><th className="py-6 px-4">Adherence</th><th className="py-6 px-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => {
                const adherence = Number(log.adherence ?? 0);
                const name = log.interpreter?.name || 'Unknown';
                return (
                  <tr key={log.id} className="group hover:bg-white/5 transition-colors">
                    <td className="py-6 px-8"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 font-bold border border-white/5">{name.charAt(0)}</div><p className="font-bold text-white">{name}</p></div></td>
                    <td className="py-6 px-4 text-gray-400 text-sm"><span className="flex items-center gap-2"><Calendar size={14} />{log.date.toLocaleDateString()}</span></td>
                    <td className="py-6 px-4 text-white font-mono">{log.interpretedMinutes ?? 0}m</td>
                    <td className="py-6 px-4 text-gray-300">{log.callsAttended ?? 0}</td>
                    <td className="py-6 px-4"><div className="flex items-center gap-2"><div className="w-12 bg-white/5 h-1.5 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", adherence >= 90 ? "bg-green-500" : adherence >= 80 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${Math.min(adherence, 100)}%` }} /></div><span className="text-xs font-bold text-white">{adherence.toFixed(2)}%</span></div></td>
                    <td className="py-6 px-4 text-right"><ProductionLogActions log={{ id: log.id, interpreterId: log.interpreterId, date: toDateInputValue(log.date), interpretedMinutes: log.interpretedMinutes ?? 0, callsAttended: log.callsAttended ?? 0, adherence, status: log.status, observaciones: log.observaciones, interpreterName: name }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && <div className="p-20 text-center"><Clock size={48} className="mx-auto text-gray-700 mb-4" /><p className="text-gray-500">No production logs found.</p></div>}
      </div>
    </div>
  );
}
