import React from 'react';
import Link from 'next/link';
import { 
  DollarSign, 
  AlertCircle, 
  TrendingUp,
  Clock
} from 'lucide-react';
import prisma from '@/lib/prisma';

import { GeneratePayrollButton } from '@/components/GeneratePayrollButton';
import { ExportPayrollButton } from '@/components/ExportPayrollButton';
import PayrollAdjustment from '@/components/admin/PayrollAdjustment';

interface PayrollRecord {
  id: number;
  netTotal: number | string | null;
  status: string;
}

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

  const totalPayout = records.reduce((acc: number, rec: PayrollRecord) => acc + parseFloat(rec.netTotal?.toString() || '0'), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">Payroll Management</h2>
          <p className="text-gray-400">Calculate and manage interpreter payments</p>
        </div>
        <div className="flex gap-4">
          <Link 
            href="/admin/production/manual"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-bold hover:bg-blue-600/30 transition-all"
          >
            <Clock size={16} /> Registro Manual
          </Link>
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
            <h3 className="text-4xl font-black text-white tracking-tight">RD${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          </div>
          <TrendingUp size={24} className="mt-4 text-indigo-400 relative z-10" />
        </div>
        
        <div className="bg-gradient-to-br from-emerald-900/40 to-slate-900/60 p-6 rounded-3xl border border-emerald-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-emerald-200/70 font-medium tracking-wide uppercase">Pending Payments</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">
              {records.filter((r: PayrollRecord) => r.status === 'PENDING' || r.status === 'Pendiente').length}
            </h3>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]">Action Needed</span>
          </div>
          <AlertCircle size={24} className="mt-4 text-emerald-400 relative z-10" />
        </div>
        
        <div className="bg-gradient-to-br from-purple-900/40 to-slate-900/60 p-6 rounded-3xl border border-purple-500/20 shadow-lg relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 p-16 bg-purple-500/10 blur-[50px] rounded-full pointer-events-none" />
          <p className="text-sm text-purple-200/70 font-medium tracking-wide uppercase">Last Cycle Avg.</p>
          <div className="flex items-center gap-3 mt-2 relative z-10">
            <h3 className="text-4xl font-black text-white tracking-tight">RD$450.00</h3>
            <span className="text-xs font-bold text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]">Per Int.</span>
          </div>
          <DollarSign size={24} className="mt-4 text-purple-400 relative z-10" />
        </div>
      </div>

      {/* Payroll List & Verification Engine */}
      <div className="glass rounded-[2.5rem] p-8">
        <PayrollAdjustment />
      </div>
    </div>
  );
}
