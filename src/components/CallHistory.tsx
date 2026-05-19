'use client';

import React, { useState } from 'react';
import { History, Search, Clock } from 'lucide-react';

interface Call {
  id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  call_cost: number | null;
  tariff_snapshot: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function CallHistory({ calls }: { calls: Call[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCalls = calls.filter(call => {
    const dateStr = formatDate(call.started_at).toLowerCase();
    const timeStr = formatTime(call.started_at).toLowerCase();
    return dateStr.includes(searchTerm.toLowerCase()) || timeStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="glass rounded-3xl p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <History size={22} className="text-indigo-400" />
          <h3 className="text-xl font-bold text-white">Call History</h3>
        </div>
        
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search by date (e.g. May 1)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* Mobile View (Cards) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredCalls.map((call) => (
            <div key={call.id} className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span suppressHydrationWarning className="text-white font-semibold text-sm">{formatDate(call.started_at)}</span>
                  <span suppressHydrationWarning className="text-slate-400 text-xs">{formatTime(call.started_at)}</span>
                </div>
                <span className="text-emerald-400 font-bold tracking-tight bg-emerald-500/10 px-2 py-1 rounded-lg text-sm">
                  RD${call.call_cost ? Number(call.call_cost).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/5">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Duration</p>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-800/80 text-white text-xs font-mono">
                    <Clock size={12} className="text-slate-400" />
                    {call.duration_seconds ? formatDuration(call.duration_seconds) : '—'}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Rate</p>
                  <p className="text-slate-300 text-xs font-medium">RD${(Number(call.tariff_snapshot) * 60).toFixed(2)}/hr</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (Table) */}
        <table className="w-full text-left hidden md:table">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="pb-4 px-2 font-semibold">Date & Time</th>
              <th className="pb-4 px-2 font-semibold text-center">Duration</th>
              <th className="pb-4 px-2 font-semibold text-center">Hourly Rate</th>
              <th className="pb-4 px-2 font-semibold text-right">Earnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredCalls.map((call) => (
              <tr key={call.id} className="group hover:bg-white/5 transition-all duration-300">
                <td className="py-4 px-2">
                  <div className="flex flex-col">
                    <span suppressHydrationWarning className="text-slate-200 text-sm font-medium">{formatDate(call.started_at)}</span>
                    <span suppressHydrationWarning className="text-slate-500 text-xs">{formatTime(call.started_at)}</span>
                  </div>
                </td>
                <td className="py-4 px-2 text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/50 text-white text-sm font-mono">
                    <Clock size={12} className="text-slate-400" />
                    {call.duration_seconds ? formatDuration(call.duration_seconds) : '—'}
                  </div>
                </td>
                <td className="py-4 px-2 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-slate-300 text-sm font-medium">RD${(Number(call.tariff_snapshot) * 60).toFixed(2)}/hr</span>
                  </div>
                </td>
                <td className="py-4 px-2 text-right">
                  <span className="text-emerald-400 font-bold text-sm tracking-tight">
                    RD${call.call_cost ? Number(call.call_cost).toFixed(2) : '0.00'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredCalls.length === 0 && (
          <div className="py-20 text-center">
            <History size={40} className="mx-auto text-slate-800 mb-4" />
            <p className="text-slate-500 font-medium">No calls found match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
