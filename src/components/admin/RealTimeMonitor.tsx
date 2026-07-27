'use client';

import { useEffect, useState, useTransition, useMemo, useCallback, useRef } from 'react';
import { createClient, isSupabaseBrowserConfigError } from '@/lib/supabase/client';
import { getLiveRosterAction } from '@/app/actions/monitoring';
import type { MonitoredInterpreter } from '@/lib/validators/monitoring';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/admin/StatusTimeline';
import {
  Search, Filter, Users, Wifi, WifiOff, ShieldCheck,
  Phone, Coffee, Activity, RefreshCw, Clock, Hash,
  TrendingUp, TrendingDown, Minus, MoreHorizontal,
  Eye, EyeOff, Timer, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'Online', label: '🟢 Online', color: 'text-emerald-400' },
  { value: 'Busy', label: '🟡 En llamada', color: 'text-amber-400' },
  { value: 'Away', label: '🟠 Ausente', color: 'text-orange-400' },
  { value: 'Offline', label: '🔴 Offline', color: 'text-slate-400' },
];

const STATUS_SECTIONS = [
  { key: 'Online', label: 'Online', icon: Wifi, color: 'emerald', bg: 'from-emerald-500/5' },
  { key: 'Busy', label: 'En llamada', icon: Phone, color: 'amber', bg: 'from-amber-500/5' },
  { key: 'Away', label: 'Ausente', icon: Coffee, color: 'orange', bg: 'from-orange-500/5' },
  { key: 'Offline', label: 'Offline', icon: WifiOff, color: 'slate', bg: 'from-slate-500/5' },
];

interface PresenceTrackPayload {
  interpreterId: number;
  user_email: string;
  online_at: string;
}

type TelemetryStatus = 'connected' | 'disconnected' | 'connecting';

// Session duration tracking (for Busy interpreters)
interface SessionTracker {
  [interpreterId: number]: {
    startedAt: number;
    accumulated: number;
  };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionTracker>({});
  const [previousRoster, setPreviousRoster] = useState<Map<number, string>>(new Map());
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Session duration tracker ──
  useEffect(() => {
    // Initialize or update sessions based on Busy interpreters
    const now = Date.now();
    setSessions((prev) => {
      const updated = { ...prev };
      for (const interpreter of roster) {
        if (interpreter.realtimeStatus === 'Busy') {
          if (!updated[interpreter.id] || updated[interpreter.id].accumulated === 0) {
            updated[interpreter.id] = {
              startedAt: now,
              accumulated: 0,
            };
          }
        } else {
          // Accumulate and pause when not busy
          if (updated[interpreter.id] && updated[interpreter.id].accumulated >= 0) {
            updated[interpreter.id] = {
              startedAt: now,
              accumulated: updated[interpreter.id].accumulated + Math.floor((now - updated[interpreter.id].startedAt) / 1000),
            };
            // Keep accumulated but mark as not actively counting
          }
        }
      }
      return updated;
    });
  }, [roster]);

  // Tick every second to update session durations
  useEffect(() => {
    sessionTimerRef.current = setInterval(() => {
      setSessions((prev) => {
        const now = Date.now();
        const updated = { ...prev };
        for (const id of Object.keys(updated).map(Number)) {
          const interpreter = roster.find((i) => i.id === id);
          if (interpreter?.realtimeStatus === 'Busy') {
            updated[id] = {
              ...updated[id],
              startedAt: now,
            };
          }
        }
        return updated;
      });
    }, 1000);
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [roster]);

  const getSessionDuration = useCallback(
    (interpreterId: number): number => {
      const session = sessions[interpreterId];
      if (!session) return 0;
      const interpreter = roster.find((i) => i.id === interpreterId);
      if (interpreter?.realtimeStatus === 'Busy') {
        return session.accumulated + Math.floor((Date.now() - session.startedAt) / 1000);
      }
      return session.accumulated || 0;
    },
    [sessions, roster]
  );

  // Fetch roster
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
          setRoster((prevRoster) => {
            // Track status changes for highlighting
            const prevMap = new Map(prevRoster.map((i) => [i.id, i.realtimeStatus || 'Offline']));
            setPreviousRoster(prevMap);
            return result.data!;
          });
          setLastUpdated(new Date());
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

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchRoster({ search: search || undefined, campaign: campaign || undefined, realtimeStatus: statusFilter || undefined });
    }, 15_000);
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

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel!.track({
            role: 'admin-observer',
            online_at: new Date().toISOString(),
          });
          setTelemetryStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setTelemetryStatus('disconnected');
        }
      });
    } catch (err) {
      if (isSupabaseBrowserConfigError(err)) {
        setTelemetryStatus('disconnected');
      } else {
        console.error('[Monitoring] Presence init error:', err);
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

  // Merge presence into roster
  interface MonitoredInterpreterWithPresence extends MonitoredInterpreter {
    _presenceOnline: boolean;
  }

  const mergedRoster: MonitoredInterpreterWithPresence[] = useMemo(() => {
    return roster.map((interpreter) => ({
      ...interpreter,
      _presenceOnline: onlineIds.has(interpreter.id),
    }));
  }, [roster, onlineIds]);

  // Detect just-changed interpreters (last 60s)
  const justChanged = useMemo(() => {
    const now = Date.now();
    const changed = new Set<number>();
    for (const i of roster) {
      if (i.statusChangedAt) {
        const diff = now - new Date(i.statusChangedAt).getTime();
        if (diff < 60_000) changed.add(i.id);
      }
    }
    return changed;
  }, [roster]);

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

  // Campaign distribution
  const campaignStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const i of roster) {
      const c = i.campaign || 'Sin campaña';
      stats[c] = (stats[c] || 0) + 1;
    }
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [roster]);

  // Group by status
  const groupedRoster = useMemo(() => {
    const groups: Record<string, MonitoredInterpreterWithPresence[]> = {
      Online: [], Busy: [], Away: [], Offline: [],
    };
    for (const i of mergedRoster) {
      const s = i.realtimeStatus || 'Offline';
      if (groups[s]) groups[s].push(i);
      else groups.Offline.push(i);
    }
    return groups;
  }, [mergedRoster]);

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

  // KPI cards
  const total = roster.length;
  const onlineToday = statusCounts.Online + statusCounts.Busy + statusCounts.Away;
  const engagementRate = total > 0 ? Math.round(((statusCounts.Online + statusCounts.Busy) / total) * 100) : 0;

  const kpiCards = [
    {
      label: 'Disponibles',
      value: statusCounts.Online,
      sub: `${statusCounts.Online === 1 ? 'listo' : 'listos'} para llamadas`,
      icon: Wifi,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      trend: engagementRate,
      trendLabel: 'tasa de actividad',
    },
    {
      label: 'En llamada',
      value: statusCounts.Busy,
      sub: statusCounts.Busy === 1 ? 'sesión activa' : 'sesiones activas',
      icon: Phone,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      trend: null,
      trendLabel: null,
    },
    {
      label: 'Ausentes',
      value: statusCounts.Away,
      sub: statusCounts.Away === 1 ? 'sin actividad' : 'sin actividad',
      icon: Coffee,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      trend: null,
      trendLabel: null,
    },
    {
      label: 'Offline',
      value: statusCounts.Offline,
      sub: `${total} total en roster`,
      icon: WifiOff,
      color: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
      trend: total - onlineToday,
      trendLabel: 'no disponibles',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className={cn(
              'rounded-2xl border p-5 relative overflow-hidden group flex flex-col justify-between min-h-[130px] transition-all hover:scale-[1.02]',
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
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500">{card.sub}</p>
              {card.trend !== null && (
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                  {card.trend}%
                  {card.trend >= 50 ? (
                    <TrendingUp size={12} className="text-emerald-500" />
                  ) : card.trend >= 25 ? (
                    <Minus size={12} className="text-amber-500" />
                  ) : (
                    <TrendingDown size={12} className="text-red-500" />
                  )}
                </span>
              )}
            </div>
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
          <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={campaign}
            onChange={(e) => handleCampaignChange(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-8 text-sm text-gray-100 appearance-none focus:border-gray-500 cursor-pointer"
          >
            <option value="">Todas las Campañas</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
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

        <span className="text-xs text-gray-500 ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="flex items-center gap-1 text-gray-600">
              <Clock size={11} />
              {formatRelativeTime(lastUpdated.toISOString())}
            </span>
          )}
          <ShieldCheck size={12} className="inline" />
          {telemetryStatus === 'connected' ? (
            <span className="text-emerald-400">Presence OK</span>
          ) : telemetryStatus === 'connecting' ? (
            <span className="text-amber-400">...</span>
          ) : (
            <span className="text-red-400">Offline</span>
          )}
        </span>
      </div>

      {/* Campaign Mini Stats */}
      {campaignStats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {campaignStats.map(([name, count]) => (
            <div
              key={name}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-900 border border-gray-800 text-[11px] text-gray-400"
            >
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                name === 'Sin campaña' ? 'bg-gray-600' : 'bg-blue-500'
              )} />
              {name}
              <span className="text-gray-500 font-mono">×{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Content: Status-grouped sections */}
      <div className="space-y-4">
        {STATUS_SECTIONS.map((section) => {
          const interpretersInSection = groupedRoster[section.key] || [];
          if (interpretersInSection.length === 0) return null;

          return (
            <div
              key={section.key}
              className={cn(
                'rounded-xl border border-gray-800 bg-gradient-to-br from-transparent to-gray-900/60 overflow-hidden',
                section.bg
              )}
            >
              {/* Section Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/50">
                <div className="flex items-center gap-2.5">
                  <section.icon size={16} className={cn('text-' + section.color + '-400')} />
                  <h3 className="text-sm font-semibold text-gray-200">
                    {section.label}
                  </h3>
                  <span className={cn(
                    'text-xs font-mono px-1.5 py-0.5 rounded',
                    `bg-${section.color}-500/10 text-${section.color}-400`
                  )}>
                    {interpretersInSection.length}
                  </span>
                </div>
              </div>

              {/* Interpreter Cards */}
              <div className="divide-y divide-gray-800/30">
                {interpretersInSection.map((interpreter) => {
                  const status = interpreter.realtimeStatus || 'Offline';
                  const isJustChanged = justChanged.has(interpreter.id);
                  const sessionDuration = getSessionDuration(interpreter.id);
                  const isExpanded = expandedRow === interpreter.id;

                  return (
                    <div key={interpreter.id}>
                      {/* Main Row */}
                      <div
                        className={cn(
                          'flex items-center gap-3 px-5 py-2.5 transition-colors cursor-pointer hover:bg-white/[0.02]',
                          isJustChanged && 'bg-white/[0.03] animate-pulse'
                        )}
                        onClick={() => {
                          setExpandedRow(isExpanded ? null : interpreter.id);
                          setSelectedInterpreter(interpreter);
                        }}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                          status === 'Online' ? 'bg-emerald-500/20 text-emerald-400' :
                          status === 'Busy' ? 'bg-amber-500/20 text-amber-400' :
                          status === 'Away' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-slate-500/20 text-slate-400'
                        )}>
                          {interpreter.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-100 truncate">
                              {interpreter.name}
                            </span>
                            {isJustChanged && (
                              <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full animate-pulse shrink-0">
                                Ahora
                              </span>
                            )}
                            {status === 'Busy' && sessionDuration > 30 && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <Timer size={10} />
                                {formatDuration(sessionDuration)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            <span className="font-mono">{interpreter.externalId}</span>
                            {interpreter.campaign && (
                              <>
                                <span className="text-gray-700">·</span>
                                <span>{interpreter.campaign}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status */}
                        <div className="shrink-0">
                          <StatusBadge
                            status={status}
                            statusReason={interpreter.statusReason}
                            size="sm"
                            showTime={false}
                          />
                        </div>

                        {/* Last Activity */}
                        <div className="hidden md:block text-[11px] text-gray-500 font-mono min-w-[80px] text-right shrink-0">
                          {formatRelativeTime(interpreter.lastHeartbeat || interpreter.statusChangedAt)}
                        </div>

                        {/* Expand toggle */}
                        <MoreHorizontal size={14} className={cn(
                          'text-gray-600 transition-transform shrink-0',
                          isExpanded && 'rotate-90'
                        )} />
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-5 py-3 bg-gray-900/40 border-t border-gray-800/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-gray-500 mb-0.5">ID Externo</p>
                              <p className="text-gray-300 font-mono">{interpreter.externalId}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-0.5">Estado</p>
                              <p className="text-gray-300 capitalize">{status}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-0.5">Razón</p>
                              <p className="text-gray-300">{formatReason(interpreter.statusReason)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-0.5">Último Heartbeat</p>
                              <p className="text-gray-300">{formatRelativeTime(interpreter.lastHeartbeat)}</p>
                            </div>
                            {interpreter.campaign && (
                              <div>
                                <p className="text-gray-500 mb-0.5">Campaña</p>
                                <p className="text-gray-300">{interpreter.campaign}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-gray-500 mb-0.5">Última Actividad</p>
                              <p className="text-gray-300">{formatRelativeTime(interpreter.lastActivity)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-0.5">Estado Cambió</p>
                              <p className="text-gray-300">{formatRelativeTime(interpreter.statusChangedAt)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-0.5">Presence</p>
                              <p className={interpreter._presenceOnline ? 'text-emerald-400' : 'text-gray-500'}>
                                {interpreter._presenceOnline ? 'Online ✓' : 'No detectado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {mergedRoster.length === 0 && !isInitialLoading && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-12 text-center">
            <Users size={48} className="mx-auto mb-3 text-gray-700" />
            <p className="text-gray-400 text-sm">No se encontraron intérpretes con los filtros actuales.</p>
          </div>
        )}

        {/* Loading State */}
        {isInitialLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800/50 animate-pulse">
                  <div className="h-4 w-32 rounded bg-gray-800" />
                </div>
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-gray-800" />
                    <div className="flex-1">
                      <div className="h-4 w-40 rounded bg-gray-800 mb-1" />
                      <div className="h-3 w-24 rounded bg-gray-800/60" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-gray-800" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Timeline */}
      {selectedInterpreter && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                {selectedInterpreter.name}
                <StatusBadge
                  status={selectedInterpreter.realtimeStatus || 'Offline'}
                  size="sm"
                  showTime={false}
                />
              </h3>
              <p className="text-xs text-gray-400">
                ID: {selectedInterpreter.externalId}
                {selectedInterpreter.campaign && ` · ${selectedInterpreter.campaign}`}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedInterpreter(null);
                setExpandedRow(null);
              }}
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