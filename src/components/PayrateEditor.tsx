'use client';

import React, { useState, useTransition } from 'react';
import { Check, X, Pencil, Loader2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { updatePayrate } from '@/app/actions/payrates';
import { cn } from '@/lib/utils';
import { AccountRateManager } from './AccountRateManager';

interface Props {
  interpreter: {
    id: number;
    name: string;
    externalId: string;
    campaign: string | null;
    status: string;
    tariffPerMinute: number;
    accountRates: Array<{
      accountId: number;
      tariffPerHour: number;
    }>;
  };
}

export function PayrateEditor({ interpreter }: Props) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rate, setRate] = useState(interpreter.tariffPerMinute);
  const [inputValue, setInputValue] = useState((interpreter.tariffPerMinute * 60).toFixed(2));
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);

  function handleSave() {
    const newRate = parseFloat(inputValue);
    if (isNaN(newRate) || newRate <= 0 || newRate > 999.99) {
      setFlash('error');
      setTimeout(() => setFlash(null), 2000);
      return;
    }

    startTransition(async () => {
      const perMinuteRate = newRate / 60;
      const result = await updatePayrate(interpreter.id, perMinuteRate);
      if (result.success) {
        setRate(perMinuteRate);
        setEditing(false);
        setFlash('success');
        setTimeout(() => setFlash(null), 2000);
      } else {
        setFlash('error');
        setTimeout(() => setFlash(null), 2000);
      }
    });
  }

  function handleCancel() {
    setInputValue((rate * 60).toFixed(2));
    setEditing(false);
  }

  return (
    <>
      <tr className={cn(
        'hover:bg-white/5 transition-all group',
        flash === 'success' && 'bg-green-500/5',
        flash === 'error' && 'bg-red-500/5',
        expanded && 'bg-white/5'
      )}>
        <td className="py-4 px-2">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "p-1 rounded-lg hover:bg-white/10 transition-colors",
                expanded ? "text-blue-400" : "text-gray-500"
              )}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="text-white font-medium">{interpreter.name}</span>
          </div>
        </td>
        <td className="py-4 px-2 text-gray-500 text-xs font-mono">{interpreter.externalId}</td>
        <td className="py-4 px-2 text-gray-400 text-sm">{interpreter.campaign || '—'}</td>
        <td className="py-4 px-2">
          <span className={cn(
            'px-2 py-1 rounded-lg text-xs font-medium',
            interpreter.status === 'Activo' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'
          )}>
            {interpreter.status}
          </span>
        </td>
        <td className="py-4 px-2">
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-gray-500">RD$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="999.99"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-28 px-2 py-1 bg-white/10 border border-blue-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              <span className={cn(
                'text-blue-400 font-bold transition-all',
                flash === 'success' && 'text-green-400'
              )}>
                RD${(rate * 60).toFixed(2)}/hr
              </span>
              {interpreter.accountRates.length > 0 && (
                <span className="text-[10px] text-purple-400 flex items-center gap-1 mt-1">
                  <Layers size={10} />
                  {interpreter.accountRates.length} tarifas especiales
                </span>
              )}
            </div>
          )}
        </td>
        <td className="py-4 px-2 text-right">
          <div className="flex items-center justify-end gap-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isPending}
                  className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white/[0.02] border-b border-white/5 animate-in slide-in-from-top-2 duration-300">
          <td colSpan={6} className="py-6 px-12">
            <div className="max-w-2xl">
              <AccountRateManager 
                interpreterId={interpreter.id} 
                initialRates={interpreter.accountRates} 
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
