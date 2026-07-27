'use client';

import { usePresenceFeed } from '@/lib/hooks/usePresenceFeed';
import StatusBadge from '@/components/StatusBadge';
import { Users, Wifi, WifiOff } from 'lucide-react';

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function LiveRosterPanel() {
  const { byId, error } = usePresenceFeed();
  const interpreters = Array.from(byId.values());

  const online = interpreters.filter(i => i.realtimeStatus === 'Online').length;
  const offline = interpreters.filter(i => i.realtimeStatus === 'Offline').length;
  const busy = interpreters.filter(i => i.realtimeStatus === 'Busy').length;
  const away = interpreters.filter(i => i.realtimeStatus === 'Away').length;

  return (
    <div className="glass p-6 rounded-3xl border border-white/5 bg-slate-900/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-3">
          <Users className="text-blue-400" />
          Intérpretes en Vivo
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">🟢 {online}</span>
          <span className="text-amber-400">🟡 {busy}</span>
          <span className="text-orange-400">🟠 {away}</span>
          <span className="text-slate-400">🔴 {offline}</span>
          {error && <span className="text-rose-400 text-[10px]">⚠️ error</span>}
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {interpreters.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <WifiOff className="mx-auto mb-2 opacity-30" size={32} />
            Cargando...
          </div>
        )}

        {interpreters.map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <StatusBadge
                status={i.realtimeStatus}
                size="sm"
                showTime={false}
              />
              <span className="text-sm font-medium text-slate-200 truncate">
                {i.name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono shrink-0">
              {i.lastHeartbeat && (
                <span className="tabular-nums">{formatTimeAgo(i.lastHeartbeat)}</span>
              )}
              {i.lastActivity && (
                <span className="text-slate-600">· {formatTimeAgo(i.lastActivity)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}