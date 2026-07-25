'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const HEARTBEAT_INTERVAL = 60_000; // 60s entre heartbeats
const STATUS_CHECK_INTERVAL = 30_000; // 30s entre checks de estado

interface HeartbeatProviderProps {
  children: React.ReactNode;
}

/**
 * HeartbeatProvider
 * 
 * Envía heartbeats periódicos al servidor mientras el intérprete
 * esté logueado. Detecta cierre de pestaña/navegador y marca
 * al intérprete como Offline automáticamente.
 * 
 * Usar: <HeartbeatProvider><App /></HeartbeatProvider>
 */
export default function HeartbeatProvider({ children }: HeartbeatProviderProps) {
  const router = useRouter();
  const tabIdRef = useRef<string>('');
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusCheckRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  // Generar o recuperar tabId único para esta sesión de navegador
  useEffect(() => {
    let stored = sessionStorage.getItem('tad-tab-id');
    if (!stored) {
      stored = crypto.randomUUID();
      sessionStorage.setItem('tad-tab-id', stored);
    }
    tabIdRef.current = stored;
  }, []);

  // Enviar heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!isActiveRef.current) return;
    try {
      const res = await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'heartbeat',
          tabId: tabIdRef.current,
        }),
      });
      if (!res.ok) {
        console.warn('[Heartbeat] Failed:', res.status);
      }
    } catch (err) {
      // Silently fail — no need to log network errors aggressively
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Heartbeat] Network error (expected if logged out):', err);
      }
    }
  }, []);

  // Marcar Online al iniciar
  const setOnline = useCallback(async () => {
    try {
      await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'online',
          tabId: tabIdRef.current,
          reason: 'login',
        }),
      });
    } catch {
      // Ignorar errores de red en SSR
    }
  }, []);

  // Marcar Offline al cerrar
  const setOffline = useCallback(async (reason: string = 'browser_closed') => {
    try {
      // Usar sendBeacon para garantizar que la request se complete
      // incluso cuando el navegador se está cerrando
      const blob = new Blob(
        [JSON.stringify({ type: 'offline', tabId: tabIdRef.current, reason })],
        { type: 'application/json' }
      );
      navigator.sendBeacon('/api/presence', blob);
    } catch {
      // Fallback: fetch síncrono no es posible aquí
    }
  }, []);

  // Inicializar heartbeats y detectar cierre
  useEffect(() => {
    // Pequeño delay para asegurar que el componente está montado
    const initTimer = setTimeout(() => {
      setOnline();

      // Heartbeat periódico
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

      // Status check periódico (refresca UI si cambia estado externamente)
      statusCheckRef.current = setInterval(() => {
        router.refresh();
      }, STATUS_CHECK_INTERVAL);
    }, 1000);

    // beforeunload → marcar offline
    const handleBeforeUnload = () => {
      setOffline('browser_closed');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // visibilitychange → si el tab se oculta/muestra
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        isActiveRef.current = true;
        sendHeartbeat(); // heartbeat inmediato al volver
      } else {
        isActiveRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(initTimer);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (statusCheckRef.current) clearInterval(statusCheckRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Al desmontar el provider, marcar offline
      setOffline('logout');
    };
  }, [sendHeartbeat, setOnline, setOffline, router]);

  return <>{children}</>;
}