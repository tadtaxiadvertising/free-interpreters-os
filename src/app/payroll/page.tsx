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

export const dynamic = 'force-dynamic';

async function getPayrollRecords() {
  try {
    const records = await prisma.payrollRecord.findMany({
      orderBy: {
        periodStart: 'desc'
      },
      include: {
        interpreter: true
      }
    });
    return records;
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    return [];
  }
}

export default async function PayrollPage() {
  const records = await getPayrollRecords();

  const totalPayout = records.reduce((acc, rec) => acc + rec.netTotal.toNumber(), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Payroll Management</h2>
          <p className="text-gray-400">Calculate and manage interpreter payments</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-bold border border-white/10 transition-all">
            <Download size={20} />
            Export CSV
          </button>
          <GeneratePayrollButton />
        </div>
      </header>

      {/* Payroll Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Total Payout (Lifetime)</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">${totalPayout.toLocaleString()}</h3>
          </div>
          <TrendingUp size={24} className="mt-4 text-green-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Pending Payments</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">
              {records.filter(r => r.status === 'Pendiente').length}
            </h3>
            <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">Action Needed</span>
          </div>
          <AlertCircle size={24} className="mt-4 text-yellow-400" />
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <p className="text-sm text-gray-500 font-medium">Last Cycle Avg.</p>
          <div className="flex items-center gap-3 mt-2">
            <h3 className="text-3xl font-bold text-white">$450.00</h3>
            <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">Per Int.</span>
          </div>
          <DollarSign size={24} className="mt-4 text-blue-400" />
        </div>
      </div>

      {/* Payroll List */}
      <div className="glass rounded-3xl overflow-hidden">
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
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="py-6 px-8">Interpreter</th>
              <th className="py-6 px-4">Period</th>
              <th className="py-6 px-4">Minutes</th>
              <th className="py-6 px-4">Net Total</th>
              <th className="py-6 px-4">Status</th>
              <th className="py-6 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {records.map((record) => (
              <tr key={record.id} className="group hover:bg-white/5 transition-colors">
                <td className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold border border-white/5">
                      {record.interpreter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white">{record.interpreter.name}</p>
                      <p className="text-xs text-gray-500">{record.interpreter.metodoPago}</p>
                    </div>
                  </div>
                </td>
                <td className="py-6 px-4 text-gray-400 text-sm">
                  <span className="flex items-center gap-2">
                    <Calendar size={14} />
                    {record.periodStart.toLocaleDateString()} - {record.periodEnd.toLocaleDateString()}
                  </span>
                </td>
                <td className="py-6 px-4 text-gray-300">
                  {record.totalMinutes}m
                </td>
                <td className="py-6 px-4 text-white font-mono font-bold">
                  ${record.netTotal.toString()}
                </td>
                <td className="py-6 px-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold",
                    record.status === 'Pagado' ? "bg-green-500/10 text-green-400" :
                    record.status === 'Procesando' ? "bg-blue-500/10 text-blue-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  )}>
                    {record.status}
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

        {records.length === 0 && (
          <div className="p-20 text-center">
            <DollarSign size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500">No payroll records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
