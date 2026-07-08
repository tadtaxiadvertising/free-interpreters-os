'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { createClient, isSupabaseBrowserConfigError } from '@/lib/supabase/client';
import { getLiveRosterAction } from '@/app/actions/monitoring';
import type { MonitoredInterpreter } from '@/lib/validators/monitoring';
import { Search, Filter, Users, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [campaigns, setCampaigns] = useState<string[]>([]);

  // Initial roster fetch
  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getLiveRosterAction({});
        if (result.success && result.data) {
          setRoster(result.data);
          const uniqueCampaigns = [
            ...new Set(result.data.map((i) => i.campaign).filter(Boolean)),
          ] as string[];
          setCampaigns(uniqueCampaigns.sort());
        }
      } finally {
        setIsInitialLoading(false);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase Presence subscription (observer mode — no interpreterId tracked)
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
        console.error('[Monitoring] Supabase browser config missing — telemetry unavailable');
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

  // Derived KPI values
  const onlineCount = useMemo(
    () => roster.filter((i) => onlineIds.has(i.id)).length,
    [roster, onlineIds]
  );

  // Filter handlers — each re-fetches roster with current filter state
  const handleSearchChange = (value: string) => {
    setSearch(value);
    startTransition(async () => {
      const result = await getLiveRosterAction({
        search: value.trim() || undefined,
        campaign: campaign || undefined,
      });
      if (result.success && result.data) {
        setRoster(result.data);
      }
    });
  };

  const handleCampaignChange = (value: string) => {
    setCampaign(value);
    startTransition(async () => {
      const result = await getLiveRosterAction({
        search: search.trim() || undefined,
        campaign: value || undefined,
      });
      if (result.success && result.data) {
        setRoster(result.data);
      }
    });
  };

  // KPI cards
  const kpiCards = [
    {
      label: 'En Línea',
      value: onlineCount,
      sub: `${roster.length - onlineCount} Offline`,
      icon: Wifi,
      color: 'text-emerald-400',
      accent: onlineCount > 0,
    },
    {
      label: 'Roster Total',
      value: roster.length,
      sub: 'Intérpretes Activos',
      icon: Users,
      color: 'text-blue-400',
      accent: false,
    },
    {
      label: 'Telemetría',
      value:
        telemetryStatus === 'connected'
          ? 'Conectado'
          : telemetryStatus === 'connecting'
            ? 'Conectando...'
            : 'Desconectado',
      sub: 'Supabase Presence',
      icon: telemetryStatus === 'connected' ? ShieldCheck : WifiOff,
      color: telemetryStatus === 'connected' ? 'text-emerald-400' : 'text-red-400',
      accent: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiCards.map((card, i) => (
          <div
            key={i}
            className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-[140px]"
          >
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <card.icon size={80} />
            </div>
            <div className={cn('p-3 rounded-2xl bg-white/5 w-fit mb-2', card.color)}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{card.label}</p>
              <h3 className="text-3xl font-bold text-white mt-1 leading-none">{card.value}</h3>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre o ID externo"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none ring-0 placeholder:text-gray-500 focus:border-gray-500"
          />
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <select
            value={campaign}
            onChange={(e) => handleCampaignChange(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-8 text-sm text-gray-100 appearance-none focus:border-gray-500"
          >
            <option value="">Todas las Campañas</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        {isPending && !isInitialLoading && (
          <span className="text-xs text-gray-400 animate-pulse">Actualizando...</span>
        )}
      </div>

      {/* Monitoring Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/80">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800 text-sm text-gray-200">
            <thead className="bg-gray-950/80 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Intérprete</th>
                <th className="px-3 py-2 text-left font-medium">ID Externo</th>
                <th className="px-3 py-2 text-left font-medium">Campaña</th>
                <th className="px-3 py-2 text-left font-medium">Estado En Vivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {isInitialLoading ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-3 py-2">
                      <div className="h-4 w-32 rounded bg-gray-800" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-20 rounded bg-gray-800" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-24 rounded bg-gray-800" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="h-4 w-28 rounded bg-gray-800" />
                    </td>
                  </tr>
                ))
              ) : roster.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">
                    No se encontraron intérpretes activos.
                  </td>
                </tr>
              ) : (
                roster.map((interpreter) => {
                  const isOnline = onlineIds.has(interpreter.id);
                  return (
                    <tr key={interpreter.id} className="hover:bg-gray-800/50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-100">
                        {interpreter.name}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-300">
                        {interpreter.externalId}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-300">
                        {interpreter.campaign || '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            isOnline
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800/50 text-slate-500'
                          )}
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              isOnline ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                            )}
                          />
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
