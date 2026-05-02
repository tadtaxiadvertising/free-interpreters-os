import React from 'react';
import { 
  DollarSign, 
  Search, 
  Filter, 
  MoreVertical,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Download
} from 'lucide-react';
import prisma from '@/lib/prisma';
import { cn } from '@/lib/utils';

import { GeneratePayrollButton } from '@/components/GeneratePayrollButton';
import { ExportPayrollButton } from '@/components/ExportPayrollButton';

export const dynamic = 'force-dynamic';

async function getPayrollRecords() {
  try {
    const records = await prisma.payrollRecord.findMany({
      include: { interpreter: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return JSON.parse(JSON.stringify(records));
  } catch (error) {
    console.error('Error fetching payroll records from DB:', error);
    return [];
  }
}

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  const totalPayout = records.reduce((acc: number, rec: any) => acc + parseFloat(rec.netTotal || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Payroll Management</h2>
          <p className="text-gray-400">Calculate and manage interpreter payments</p>
        </div>
        <div className="flex gap-4">
          <ExportPayrollButton data={records} />
          <GeneratePayrollButton />
        </div>
      </header>

      {/* Payroll Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/60 p-6 rounded-3xl border border-indigo-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-indigo-200/70 font-medium tracking-wide uppercase">Total Payout (Lifetime)</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <TrendingUp size={24} className="mt-4 text-indigo-400 relative z-10" />
        </div>
        
        <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/60 p-6 rounded-3xl border border-emerald-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-emerald-200/70 font-medium tracking-wide uppercase">Pending Payments</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">
              {records.filter((r: any) => r.status === 'Pendiente').length}
            </h3>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Action Needed</span>
          </div>
          <AlertCircle size={24} className="mt-4 text-emerald-400 relative z-10" />
        </div>
        
        <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/60 p-6 rounded-3xl border border-purple-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-purple-200/70 font-medium tracking-wide uppercase">Last Cycle Avg.</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">$450.00</h3>
            <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]">Per Int.</span>
          </div>
          <DollarSign size={24} className="mt-4 text-purple-400 relative z-10" />
        </div>
      </div>

      {/* Payroll List */}
      <div className="glass rounded-3xl overflow-visible">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Payment Records</h3>
          <div className="flex gap-2">
            <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors">
              <Filter size={18} />
            </button>
          </div>
        </div>

        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="py-6 px-8 font-semibold">Interpreter</th>
              <th className="py-6 px-4 font-semibold">Period</th>
              <th className="py-6 px-4 font-semibold">Minutes</th>
              <th className="py-6 px-4 text-center font-semibold">Rate (Hr/Min)</th>
              <th className="py-6 px-4 font-semibold">Net Total</th>
              <th className="py-6 px-4 font-semibold">Status</th>
              <th className="py-6 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {records.map((record: any) => (
              <tr key={record.id} className="group hover:bg-white/5 transition-all duration-300">
                <td className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 font-bold border border-white/5 shadow-inner">
                      {record.interpreter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-indigo-400 transition-colors">{record.interpreter.name}</p>
                      <p className="text-xs text-slate-500 font-mono">{record.interpreter.metodoPago}</p>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4 text-slate-400 text-sm font-medium" suppressHydrationWarning>
                  <span className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-500" />
                    {new Date(record.periodStart).toLocaleDateString()} - {new Date(record.periodEnd).toLocaleDateString()}
                  </span>
                </td>
                <td className="py-6 px-4 text-white font-mono">
                  {record.totalMinutes}m
                </td>
                <td className="py-6 px-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-white text-sm font-bold font-mono">${(parseFloat(record.interpreter.tariffPerMinute.toString()) * 60).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 font-mono">${record.interpreter.tariffPerMinute.toString()}/m</span>
                  </div>
                </td>
                <td className="py-6 px-4">
                  <span className="text-emerald-400 font-bold text-lg tracking-tight">
                    ${parseFloat(record.netTotal).toFixed(2)}
                  </span>
                </td>
                <td className="py-6 px-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                    record.status === 'Pagado' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" :
                    record.status === 'Procesando' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                    "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  )}>
                    {record.status}
                  </span>
                </td>
                <td className="py-6 px-4 text-right">
                  <button className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
                    <MoreVertical size={20} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {records.length === 0 && (
          <div className="p-20 text-center bg-slate-900/20 rounded-b-3xl border-t border-white/5">
            <DollarSign size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-500 font-medium">No payroll records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
