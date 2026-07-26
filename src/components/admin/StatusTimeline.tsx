'use client';

import { useEffect, useState } from 'react';
import { Clock, Activity, Wifi, WifiOff, Phone, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusLogEntry {
  id: number;
  previousStatus: string | null;
  newStatus: string;
  reason: string;
  changedBy: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface StatusTimelineProps {
  interpreterId: number;
  limit?: number;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Online: <Wifi size={14} />,
  Offline: <WifiOff size={14} />,
  Busy: <Phone size={14} />,
  Away: <Coffee size={14} />,
};

const STATUS_COLORS: Record<string, string> = {
  Online: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  Offline: 'border-slate-500/40 bg-slate-500/10 text-slate-400',
  Busy: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  Away: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  // Today: show time only
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' });
  }

  // This week: show day + time
  const dayDiff = Math.floor(diffMs / 86400000);
  if (dayDiff < 7) {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return `${days[d.getDay()]} ${d.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Older: show date
  return d.toLocaleDateString('es-DO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    manual: 'Cambio manual',
    login: 'Inicio de sesión',
    browser_closed: 'Navegador cerrado',
    inactivity_timeout: 'Inactividad (5 min)',
    heartbeat_timeout: 'Sin señal (10 min)',
    activity_detected: 'Actividad detectada',
    call_started: 'Llamada iniciada',
    call_ended: 'Llamada finalizada',
    admin_override: 'Admin',
    logout: 'Cierre de sesión',
    initial: 'Estado inicial',
  };
  return map[reason] || reason.replace(/_/g, ' ');
}

export default function StatusTimeline({ interpreterId, limit = 20 }: StatusTimelineProps) {
  const [logs, setLogs] = useState<StatusLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interpreterId) return;

    setIsLoading(true);
    setError(null);

    async function fetchLogs() {
      try {
        const res = await fetch(`/api/v1/interpreters/${interpreterId}/status-history?limit=${limit}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err) {
        // API not available yet — graceful fallback
        console.warn('[StatusTimeline] API not available:', err);
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLogs();
  }, [interpreterId, limit]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-800" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-32 rounded bg-gray-800" />
              <div className="h-2 w-20 rounded bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity size={24} className="mx-auto text-gray-600 mb-2" />
        <p className="text-sm text-gray-500">No hay historial de estado disponible.</p>
        <p className="text-xs text-gray-600 mt-1">
          El historial comienza a registrarse cuando los intérpretes usan el sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-800" />

      <div className="space-y-0">
        {logs.map((log, idx) => {
          const prev = log.previousStatus;
          const next = log.newStatus;
          const color = STATUS_COLORS[next] || STATUS_COLORS.Offline;
          const icon = STATUS_ICONS[next] || <Activity size={14} />;

          return (
            <div key={log.id} className="relative flex items-start gap-4 pb-5 pl-0">
              {/* Timeline dot */}
              <div className={cn(
                'relative z-10 w-8 h-8 rounded-full flex items-center justify-center border',
                color,
                idx === 0 && 'ring-2 ring-offset-2 ring-offset-gray-900 ring-gray-700'
              )}>
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {prev && prev !== next && (
                    <>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                        STATUS_COLORS[prev] || 'bg-gray-800 text-gray-400'
                      )}>
                        {prev}
                      </span>
                      <span className="text-gray-600 text-xs">→</span>
                    </>
                  )}
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                    color
                  )}>
                    {next}
                  </span>

                  <span className="text-[10px] text-gray-600 ml-1">
                    {formatReason(log.reason)}
                  </span>
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={10} className="text-gray-600" />
                  <span className="text-[10px] text-gray-600">
                    {formatTime(log.createdAt)}
                  </span>
                  {log.changedBy && (
                    <span className="text-[10px] text-gray-700">
                      · por {log.changedBy}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}