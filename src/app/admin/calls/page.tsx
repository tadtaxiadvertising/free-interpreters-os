import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export default async function AdminCallsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/login');

  // Fetch recent calls with interpreter names (join via interpreter_id)
  const { data: calls } = await supabase
    .from('call_sessions')
    .select(`
      id,
      interpreter_id,
      started_at,
      ended_at,
      duration_seconds,
      tariff_snapshot,
      call_cost,
      notes
    `)
    .order('started_at', { ascending: false })
    .limit(50);

  // Fetch interpreter names
  const interpreterIds = [...new Set(calls?.map(c => c.interpreter_id) || [])];
  const { data: interpreters } = await supabase
    .from('interpreters')
    .select('id, name')
    .in('id', interpreterIds.length > 0 ? interpreterIds : [0]);

  const nameMap = new Map(interpreters?.map(i => [i.id, i.name]) || []);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Phone size={28} className="text-green-400" />
          <h2 className="text-3xl font-bold text-white">Call History</h2>
        </div>
        <p className="text-gray-400">Complete call log with server-computed billing. All costs are immutable.</p>
      </header>

      <div className="glass rounded-3xl p-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="pb-3 px-2">Interpreter</th>
                <th className="pb-3 px-2">Date</th>
                <th className="pb-3 px-2">Start</th>
                <th className="pb-3 px-2">Duration</th>
                <th className="pb-3 px-2">Rate</th>
                <th className="pb-3 px-2">Cost</th>
                <th className="pb-3 px-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {calls?.map((call) => {
                const isActive = !call.ended_at;
                const startDate = new Date(call.started_at);
                return (
                  <tr key={call.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2 text-white font-medium">{nameMap.get(call.interpreter_id) || 'Unknown'}</td>
                    <td className="py-3 px-2 text-gray-400 text-sm">
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-2 text-gray-400 text-sm">
                      {startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-2 text-white font-medium text-sm">
                      {call.duration_seconds ? formatDuration(call.duration_seconds) : '—'}
                    </td>
                    <td className="py-3 px-2 text-gray-400 text-sm">${Number(call.tariff_snapshot).toFixed(2)}/m</td>
                    <td className="py-3 px-2 text-green-400 font-bold text-sm">
                      {call.call_cost ? `$${Number(call.call_cost).toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        isActive
                          ? 'bg-orange-500/10 text-orange-400 animate-pulse'
                          : 'bg-green-500/10 text-green-400'
                      )}>
                        {isActive ? '● Live' : '✓ Completed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(!calls || calls.length === 0) && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500 italic">No call records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
