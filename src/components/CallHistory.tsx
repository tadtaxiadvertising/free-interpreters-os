import React from 'react';
import { History } from 'lucide-react';

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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function CallHistory({ calls }: { calls: Call[] }) {
  if (calls.length === 0) {
    return (
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <History size={22} className="text-gray-500" />
          <h3 className="text-xl font-bold text-white">Recent Calls</h3>
        </div>
        <p className="text-gray-500 text-center py-8 italic">No completed calls yet.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <History size={22} className="text-blue-400" />
        <h3 className="text-xl font-bold text-white">Recent Calls</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
              <th className="pb-3 px-2">Date</th>
              <th className="pb-3 px-2">Start</th>
              <th className="pb-3 px-2">Duration</th>
              <th className="pb-3 px-2">Rate</th>
              <th className="pb-3 px-2 text-right">Earnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-white/5 transition-colors">
                <td className="py-3 px-2 text-gray-300 text-sm">{formatDate(call.started_at)}</td>
                <td className="py-3 px-2 text-gray-400 text-sm">{formatTime(call.started_at)}</td>
                <td className="py-3 px-2 text-white font-medium text-sm">
                  {call.duration_seconds ? formatDuration(call.duration_seconds) : '—'}
                </td>
                <td className="py-3 px-2 text-gray-400 text-sm">${Number(call.tariff_snapshot).toFixed(2)}/m</td>
                <td className="py-3 px-2 text-right">
                  <span className="text-green-400 font-bold text-sm">
                    ${call.call_cost ? Number(call.call_cost).toFixed(2) : '0.00'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
