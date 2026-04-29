'use client';

import React, { useTransition } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { generatePayrollPeriod } from '@/app/actions/payroll';
import { cn } from '@/lib/utils';

export function GeneratePayrollButton() {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generatePayrollPeriod();
      if (!result.success) {
        alert(result.error);
      } else {
        alert(result.data?.message || 'Success');
      }
    });
  };

  return (
    <button 
      onClick={handleGenerate}
      disabled={isPending}
      className={cn(
        "flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold transition-all glow",
        isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-500"
      )}
    >
      {isPending ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
      Generate Payroll
    </button>
  );
}
