'use client';

import React, { useActionState, startTransition } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { calculateInterpreterPayrollAction } from '@/actions/payroll';
import { cn } from '@/lib/utils';

export function PayrollCalculator({ interpreters }: { interpreters: { id: number, name: string }[] }) {
  const [state, action, isPending] = useActionState(calculateInterpreterPayrollAction, null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      action(formData);
    });
  };

  return (
    <div className="p-6 bg-slate-900 border border-white/10 rounded-3xl max-w-xl mx-auto shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/20 rounded-2xl border border-blue-500/30">
          <Calculator className="text-blue-400" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Settled Lock Calculator</h2>
          <p className="text-gray-400 text-sm">Calculate payroll & lock processed minutes</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider">Interpreter</label>
          <select 
            name="interpreterId"
            required
            className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors"
          >
            <option value="">Select an interpreter...</option>
            {interpreters.map(interpreter => (
              <option key={interpreter.id} value={interpreter.id}>{interpreter.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} /> Start Date
            </label>
            <input 
              type="date"
              name="startDate"
              required
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={14} /> End Date
            </label>
            <input 
              type="date"
              name="endDate"
              required
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-blue-500 transition-colors [color-scheme:dark]"
            />
          </div>
        </div>

        {(state as any)?.error && (
          <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 flex items-start gap-3 animate-in fade-in">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">{(state as any).error}</p>
          </div>
        )}

        {state?.success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p className="text-sm">{(state as any).message}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-4",
            isPending 
              ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] border border-blue-400/20"
          )}
        >
          {isPending ? (
            <><Loader2 className="animate-spin" size={20} /> Processing & Locking...</>
          ) : (
            <><Calculator size={20} /> Calculate & Lock Payroll</>
          )}
        </button>
      </form>
    </div>
  );
}
