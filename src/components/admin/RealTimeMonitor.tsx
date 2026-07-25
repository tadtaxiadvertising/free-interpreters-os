'use client';

import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import { createClient, isSupabaseBrowserConfigError } from '@/lib/supabase/client';
import { getLiveRosterAction } from '@/app/actions/monitoring';
import type { MonitoredInterpreter } from '@/lib/validators/monitoring';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/admin/StatusTimeline';
import {
  Search, Filter, Users, Wifi, WifiOff, ShieldCheck,
  Phone, Coffee, Activity, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'Online', label: '🟢 Online', color: 'text-emerald-400' },
  { value: 'Busy', label: '🟡 Busy', color: 'text-amber-400' },
  { value: 'Away', label: '🟠 Ausente', color: 'text-orange-400' },
  { value: 'Offline', label: '🔴 Offline', color: 'text-slate-400' },
];

interface PresenceTrackPayload {
  interpreterId: number;
  user_email: string;
  online_at: string;
}

type TelemetryStatus = 'connected' | 'disconnected' | 'connecting';

export default function RealTimeMonitor() {
  const [roster, setRoster] = useState<MonitoredInterpreter[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryStatus>('connecting');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [campaign, setCampaign] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [selectedInterpreter, setSelectedInterpreter] = useState<MonitoredInterpreter | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch roster with current filters
  const fetchRoster = useCallback(async (filters: {
    search?: string; campaign?: string; realtimeStatus?: string;
  }) => {
    startTransition(async () => {
      try {
        const result = await getLiveRosterAction({
          search: filters.search || undefined,
          campaign: filters.campaign || undefined,
          realtimeStatus: filters.realtimeStatus || undefined,
        });
        if (result.success && result.data) {
          setRoster(result.data);
          // Collect unique campaigns from fresh data
          const uniqueCampaigns = [
            ...new Set(result.data.map((i) => i.campaign).filter(Boolean)),
          ] as string[];
          if (uniqueCampaigns.length > 0) {
            setCampaigns((prev) =>
              [...new Set([...prev, ...uniqueCampaigns])].sort()
            );
          }
        }
      } finally {
        setIsInitialLoading(false);
      }
    });
  }, []);

  // Initial load
  useEffect(() => {
    fetchRoster({});
  }, [fetchRoster]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchRoster({ search: search || undefined, campaign: campaign || undefined, realtimeStatus: statusFilter || undefined });
    }, 30_000);
    return () => clearInterval(interval);
  }, [autoRefresh, search, campaign, statusFilter, fetchRoster]);

  // Supabase Presence subscription
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    try {
      const client = createClient();

      channel = client.channel('room:dashboard_presence', {
        config: { presence: { key: 'admin-observer' } },
      });

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState();
        const ids = new Set<number>();

        for (const [, presences] of Object.entries(state)) {
          for (const p of presences as unknown as PresenceTrackPayload[]) {
            if (typeof p.interpreterId === 'number') {
              ids.add(p.interpreterId);
            }
          }
        }

        setOnlineIds(ids);
        setTelemetryStatus('connected');
      });

      channel.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          await channel!.track({
            role: 'admin-observer',
            online_at: new Date().toISOString(),
          });
          setTelemetryStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTelemetryStatus('disconnected');
          console.error('[Monitoring] Presence channel error:', err);
        }
      });
    } catch (err) {
      if (isSupabaseBrowserConfigError(err)) {
        setTelemetryStatus('disconnected');
      } else {
        console.error('[Monitoring] Unexpected Presence init error:', err);
      }
      return;
    }

    return () => {
      if (channel) {
        channel.untrack();
        channel.unsubscribe();
      }
    };
  }, []);

  // When Presence detects an interpreter not in the DB roster, merge the data
  const mergedRoster = useMemo(() => {
    return roster.map((interpreter) => ({
      ...interpreter,
      // Override: if presence says they're online but DB says Offline, use presence
      // But trust DB's Busy/Away over presence
      _presenceOnline: onlineIds.has(interpreter.id),
    }));
  }, [roster, onlineIds]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Online: 0, Busy: 0, Away: 0, Offline: 0, Unknown: 0,
    };
    for (const i of roster) {
      const s = i.realtimeStatus || 'Offline';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [roster]);

  // Filter handlers
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    fetchRoster({ search: value || undefined, campaign: campaign || undefined, realtimeStatus: statusFilter || undefined });
  }, [campaign, statusFilter, fetchRoster]);

  const handleCampaignChange = useCallback((value: string) => {
    setCampaign(value);
    fetchRoster({ search: search || undefined, campaign: value || undefined, realtimeStatus: statusFilter || undefined });
  }, [search, statusFilter, fetchRoster]);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    fetchRoster({ search: search || undefined, campaign: campaign || undefined, realtimeStatus: value || undefined });
  }, [search, campaign, fetchRoster]);

  // KPI cards with real status data
  const kpiCards = [
    {
      label: 'Online',
      value: statusCounts.Online,
      sub: statusCounts.Online === 1 ? 'intérprete disponible' : 'intérpretes disponibles',
      icon: Wifi,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Busy',
      value: statusCounts.Busy,
      sub: statusCounts.Busy === 1 ? 'en llamada' : 'en llamadas',
      icon: Phone,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
    {
      label: 'Ausente',
      value: statusCounts.Away,
      sub: statusCounts.Away === 1 ? 'sin actividad' : 'sin actividad',
      icon: Coffee,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
    },
    {
      label: 'Offline',
      value: statusCounts.Offline,
      sub: `${roster.length} total en roster`,
      icon: WifiOff,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid - 4 estados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl border p-5 relative overflow-hidden group flex flex-col justify-between min-h-[120px] transition-all hover:scale-[1.02]',
              card.bg, card.border
            )}
          >
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <card.icon size={64} />
            </div>
            <div className={cn('p-2.5 rounded-xl bg-white/5 w-fit', card.color)}>
              <card.icon size={20} />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{card.label}</p>
              <h3 className={cn('text-3xl font-bold mt-0.5 leading-none', card.color)}>{card.value}</h3>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre o ID..."
            className="w-full rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none ring-0 placeholder:text-gray-500 focus:border-gray-500"
          />
        </div>

        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-8 text-sm text-gray-100 appearance-none focus:border-gray-500 cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="relative">
          <select
            value={campaign}
            onChange={(e) => handleCampaignChange(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 py-2 pl-3 pr-8 text-sm text-gray-100 appearance-none focus:border-gray-500 cursor-pointer"
          >
            <option value="">Todas las Campañas</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setAutoRefresh(!autoRefresh);
          }}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            autoRefresh
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          )}
        >
          <RefreshCw size={14} className={cn(autoRefresh && 'animate-spin-slow')} />
          {autoRefresh ? 'Auto' : 'Manual'}
        </button>

        {isPending && !isInitialLoading && (
          <span className="text-xs text-gray-400 animate-pulse">Actualizando...</span>
        )}

        <span className="text-xs text-gray-500 ml-auto">
          <ShieldCheck size={12} className="inline mr-1" />
          {telemetryStatus === 'connected' ? 'Presence OK' : telemetryStatus === 'connecting' ? '...' : 'Offline'}
        </span>
      </div>

      {/* Monitoring Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-200">
            <thead className="bg-gray-950/80 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Intérprete</th>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-left font-medium">Campaña</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Última actividad</th>
                <th className="px-4 py-3 text-left font-medium">Razón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isInitialLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-800" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-800" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-800" /></td>
                    <td className="px-4 py-3"><div className="h-6 w-20 rounded-full bg-gray-800" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-gray-800" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-gray-800" /></td>
                  </tr>
                ))
              ) : mergedRoster.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    <Users size={32} className="mx-auto mb-2 text-gray-600" />
                    No se encontraron intérpretes con los filtros actuales.
                  </td>
                </tr>
              ) : (
                mergedRoster.map((interpreter) => {
                  const status = interpreter.realtimeStatus || 'Offline';
                  return (
                    <tr
                      key={interpreter.id}
                      className={cn(
                        'hover:bg-gray-800/50 transition-colors cursor-pointer',
                        selectedInterpreter?.id === interpreter.id && 'bg-gray-800/70'
                      )}
                      onClick={() => setSelectedInterpreter(
                        selectedInterpreter?.id === interpreter.id ? null : interpreter
                      )}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-100">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                            status === 'Online' ? 'bg-emerald-500/20 text-emerald-400' :
                            status === 'Busy' ? 'bg-amber-500/20 text-amber-400' :
                            status === 'Away' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-slate-500/20 text-slate-400'
                          )}>
                            {interpreter.name.charAt(0)}
                          </div>
                          {interpreter.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        {interpreter.externalId}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {interpreter.campaign || <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={status}
                          statusReason={interpreter.statusReason}
                          lastHeartbeat={interpreter.lastHeartbeat}
                          statusChangedAt={interpreter.statusChangedAt}
                          size="sm"
                          showTime={false}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatRelativeTime(interpreter.lastHeartbeat || interpreter.statusChangedAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                        {formatReason(interpreter.statusReason)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Timeline — when an interpreter is selected */}
      {selectedInterpreter && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-lg">
                {selectedInterpreter.name}
              </h3>
              <p className="text-xs text-gray-400">
                ID: {selectedInterpreter.externalId}
                {selectedInterpreter.campaign && ` · ${selectedInterpreter.campaign}`}
              </p>
            </div>
            <button
              onClick={() => setSelectedInterpreter(null)}
              className="text-gray-500 hover:text-white transition-colors text-xs px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-500"
            >
              Cerrar
            </button>
          </div>
          <StatusTimeline interpreterId={selectedInterpreter.id} />
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return <span className="text-gray-600">—</span> as any;
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'ahora';
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

function formatReason(reason: string | null | undefined): string {
  if (!reason || reason === 'initial') return '—';
  return reason.replace(/_/g, ' ');
}