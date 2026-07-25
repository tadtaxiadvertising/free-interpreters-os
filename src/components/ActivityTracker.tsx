'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';

const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutos sin actividad → Away
const GRACE_AFTER_AWAY = 5_000; // 5 segundos después de volver para marcar Online

interface ActivityTrackerProps {
  interpreterId: number | null;
  options?: {
    idleTimeout?: number;
    enabled?: boolean;
  };
}

interface ActivityTrackerState {
  currentStatus: string;
  isIdle: boolean;
  idleSince: Date | null;
  lastActivity: Date | null;
}

/**
 * ActivityTracker
 * 
 * Monitorea la actividad del usuario (mouse, teclado, click, touch)
 * y actualiza el estado automáticamente:
 *   - Sin actividad por 5 min → Away
 *   - Actividad detectada estando Away → Online
 * 
 * Renderiza un span oculto (no UI visible).
 */
export default function ActivityTracker({
  interpreterId,
  options = {},
}: ActivityTrackerProps) {
  const { idleTimeout = IDLE_TIMEOUT, enabled = true } = options;
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [state, setState] = useState<ActivityTrackerState>({
    currentStatus: 'Online',
    isIdle: false,
    idleSince: null,
    lastActivity: new Date(),
  });

  const updateStatus = useCallback(async (newStatus: string, reason: string) => {
    if (!interpreterId) return;

    try {
      await fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_change',
          status: newStatus,
          reason,
        }),
      });

      setState((prev) => ({
        ...prev,
        currentStatus: newStatus,
        isIdle: newStatus === 'Away',
        idleSince: newStatus === 'Away' ? new Date() : null,
        lastActivity: new Date(),
      }));
    } catch {
      // Ignorar errores de red
    }
  }, [interpreterId]);

  const resetIdle = useCallback(() => {
    if (!enabled) return;
    
    lastActivityRef.current = Date.now();
    
    // Si estaba Away, marcar Online con un pequeño grace period
    if (state.currentStatus === 'Away') {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
      graceTimerRef.current = setTimeout(() => {
        updateStatus('Online', 'activity_detected');
      }, GRACE_AFTER_AWAY);
    }

    // Resetear el timer de idle
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (enabled) {
        updateStatus('Away', 'inactivity_timeout');
      }
    }, idleTimeout);
  }, [state.currentStatus, updateStatus, idleTimeout, enabled]);

  // Configurar event listeners al montar
  useEffect(() => {
    if (!enabled || !interpreterId) return;

    // Activity events to listen to
    const events = ['mousemove', 'mousedown', 'keydown', 'click', 'touchstart', 'scroll', 'wheel'];

    // Throttled handler — no responde más de una vez por segundo
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return; // throttle a 1s
      lastReset = now;
      resetIdle();
    };

    events.forEach((event) => window.addEventListener(event, throttledReset));

    // Start the idle timer
    resetIdle();

    return () => {
      events.forEach((event) => window.removeEventListener(event, throttledReset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, [interpreterId, enabled, resetIdle]);

  // No renderiza nada visible
  return null;
}