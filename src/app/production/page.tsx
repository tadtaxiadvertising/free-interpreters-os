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
  campaign: string | null;
  interpreter: { id: number; name: string | null; campaign: string | null; externalId: string | null } | null;
}

interface InterpreterHistoryRow {
  key: string;
  log: ProductionLog | null;
  interpreterId: number | null;
  interpreterName: string;
  interpreterInitial: string;
  interpreterCampaign: string | null;
  interpreterExternalId: string | null;
  date: Date | null;
  interpretedMinutes: number;
  callsAttended: number;
  adherence: number;
  status: string;
  observaciones: string | null;
}

type ProductionSearchParams = Promise<{ search?: string; filter?: string }>;

export const dynamic = 'force-dynamic';

async function getProductionHistory(searchParams: { search?: string; filter?: string }): Promise<InterpreterHistoryRow[]> {
  const search = searchParams.search?.trim();
  const filter = searchParams.filter?.trim();
  const isFiltered = Boolean(filter && filter !== 'all');
  const searchWhere = search
    ? {
        OR: [
          { status: { contains: search, mode: 'insensitive' as const } },
          { campaign: { contains: search, mode: 'insensitive' as const } },
          { interpreter: { name: { contains: search, mode: 'insensitive' as const } } },
          { interpreter: { externalId: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  try {
    const [logs, interpreters] = await Promise.all([
      prisma.productionLog.findMany({
        where: {
          ...(isFiltered ? { status: filter } : {}),
          ...searchWhere,
        },
        orderBy: { date: 'desc' },
        include: { interpreter: { select: { id: true, name: true, campaign: true, externalId: true } } },
      }),
      prisma.interpreter.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { externalId: { contains: search, mode: 'insensitive' } },
                { campaign: { contains: search, mode: 'insensitive' } },
                { status: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        select: { id: true, name: true, campaign: true, externalId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const rows: InterpreterHistoryRow[] = logs.map((log) => {
      const name = log.interpreter?.name || 'Unknown';
      return {
        key: `log-${log.id}`,
        log,
        interpreterId: log.interpreterId,
        interpreterName: name,
        interpreterInitial: name.charAt(0) || '?',
        interpreterCampaign: log.interpreter?.campaign ?? log.campaign,
        interpreterExternalId: log.interpreter?.externalId ?? null,
        date: log.date,
        interpretedMinutes: log.interpretedMinutes ?? 0,
        callsAttended: log.callsAttended ?? 0,
        adherence: Number(log.adherence ?? 0),
        status: log.status,
        observaciones: log.observaciones,
      };
    });

    const interpretersWithVisibleLogs = new Set(logs.map((log) => log.interpreterId).filter((id): id is number => id !== null));
    const placeholderRows = interpreters
      .filter((interpreter) => !interpretersWithVisibleLogs.has(interpreter.id))
      .map((interpreter) => ({
        key: `interpreter-${interpreter.id}`,
        log: null,
        interpreterId: interpreter.id,
        interpreterName: interpreter.name,
        interpreterInitial: interpreter.name.charAt(0) || '?',
        interpreterCampaign: interpreter.campaign,
        interpreterExternalId: interpreter.externalId,
        date: null,
        interpretedMinutes: 0,
        callsAttended: 0,
        adherence: 0,
        status: isFiltered ? `Sin registros ${filter}` : 'Sin registros',
        observaciones: null,
      }));

    return [...rows, ...placeholderRows];
  } catch (error) {
    console.error('Error fetching production history:', error);
    return [];
  }
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function ProductionPage({ searchParams }: { searchParams: ProductionSearchParams }) {
  const resolvedSearchParams = await searchParams;
  const historyRows = await getProductionHistory(resolvedSearchParams);
  const logs = historyRows.filter((row) => row.log).map((row) => row.log as ProductionLog);
  const avgAdherence = logs.length
    ? logs.reduce((acc, log) => acc + Number(log.adherence ?? 0), 0) / logs.length
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Production Logs</h2>
          <p className="text-gray-400">Daily connection metrics, call statistics and full interpreter history</p>
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
          <div className="flex flex-col gap-1"><h3 className="text-xl font-bold text-white">Activity History</h3><p className="text-sm text-gray-500">Todos los intérpretes aparecen aquí, incluso si todavía no tienen registros para el filtro actual.</p></div>
          <ProductionLogControls />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5"><th className="py-6 px-8">Interpreter</th><th className="py-6 px-4">Date</th><th className="py-6 px-4">Minutes</th><th className="py-6 px-4">Calls</th><th className="py-6 px-4">Adherence</th><th className="py-6 px-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {historyRows.map((row) => {
                const isPlaceholder = !row.log;
                return (
                  <tr key={row.key} className="group hover:bg-white/5 transition-colors">
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold border border-white/5", isPlaceholder ? "bg-slate-500/10 text-slate-400" : "bg-green-500/10 text-green-400")}>
                          {row.interpreterInitial}
                        </div>
                        <div>
                          <p className="font-bold text-white">{row.interpreterName}</p>
                          <p className="text-xs text-gray-500">{row.interpreterExternalId ?? row.interpreterCampaign ?? 'Sin campaña'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-6 px-4 text-gray-400 text-sm"><span className="flex items-center gap-2"><Calendar size={14} />{row.date ? row.date.toLocaleDateString() : 'Sin historial'}</span></td>
                    <td className="py-6 px-4 text-white font-mono">{row.interpretedMinutes}m</td>
                    <td className="py-6 px-4 text-gray-300">{row.callsAttended}</td>
                    <td className="py-6 px-4"><div className="flex items-center gap-2"><div className="w-12 bg-white/5 h-1.5 rounded-full overflow-hidden"><div className={cn("h-full rounded-full", row.adherence >= 90 ? "bg-green-500" : row.adherence >= 80 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${Math.min(row.adherence, 100)}%` }} /></div><span className="text-xs font-bold text-white">{row.adherence.toFixed(2)}%</span></div></td>
                    <td className="py-6 px-4 text-right">
                      {row.log ? (
                        <ProductionLogActions log={{ id: row.log.id, interpreterId: row.log.interpreterId, date: toDateInputValue(row.log.date), interpretedMinutes: row.interpretedMinutes, callsAttended: row.callsAttended, adherence: row.adherence, status: row.status, observaciones: row.observaciones, interpreterName: row.interpreterName }} />
                      ) : (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-gray-400">{row.status}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {historyRows.length === 0 && <div className="p-20 text-center"><Clock size={48} className="mx-auto text-gray-700 mb-4" /><p className="text-gray-500">No production logs found.</p></div>}
      </div>
    </div>
  );
}
