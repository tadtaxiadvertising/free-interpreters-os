'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface InterpreterPresence {
  id: number;
  name: string;
  externalId: string;
  realtimeStatus: string | null;
  statusReason: string | null;
  lastHeartbeat: string | null;
  lastActivity: string | null;
  statusChangedAt: string | null;
}

const POLL_INTERVAL = 15000;

export function usePresenceFeed() {
  const [state, setState] = useState<{ byId: Map<number, InterpreterPresence>; updatedAt: Date | null; error: string | null }>({
    byId: new Map(),
    updatedAt: null,
    error: null,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/presence/roster', {
        cache: 'no-store',
        next: { revalidate: 0 },
      });
      if (!res.ok) return;
      const json = await res.json();
      const list: InterpreterPresence[] = Array.isArray(json.interpreters) ? json.interpreters : [];
      const byId = new Map<number, InterpreterPresence>();
      for (const item of list) byId.set(item.id, item);
      setState({ byId, updatedAt: new Date(), error: null });
    } catch (e: any) {
      setState((prev) => ({ ...prev, error: e?.message || 'Error de conexión' }));
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const getInterpreter = useCallback((id: number) => state.byId.get(id), [state.byId]);

  return { ...state, getInterpreter };
}
