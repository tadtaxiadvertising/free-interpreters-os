'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePresenceState } from '@supabase/supabase-js';
import type { PresenceState } from '@/contexts/PresenceContext';

interface PresenceTrackPayload {
  interpreterId: number;
  user_email: string;
  online_at: string;
}

interface UsePresenceOptions {
  interpreterId: number | null;
  userEmail: string;
}

export function usePresence({ interpreterId, userEmail }: UsePresenceOptions): PresenceState {
  const [state, setState] = useState<PresenceState>('loading');
  const channelRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Update lastActivity on user interaction
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!interpreterId) {
      setState('offline');
      return;
    }

    const client = createClient();
    if (!client) {
      setState('offline');
      return;
    }
    const presenceKey = String(interpreterId);

    const channel = client.channel('room:dashboard_presence', {
      config: { presence: { key: presenceKey } },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState: RealtimePresenceState = channel.presenceState();
      const myPresences = presenceState[presenceKey];
      if (myPresences && myPresences.length > 0) {
        setState('online');
      }
    });

    channel.on<PresenceTrackPayload>('presence', { event: 'join' }, ({ key }) => {
      if (key === presenceKey) {
        setState('online');
      }
    });

    channel.on<PresenceTrackPayload>('presence', { event: 'leave' }, ({ key }) => {
      if (key === presenceKey) {
        setState('offline');
      }
    });

    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          interpreterId,
          user_email: userEmail,
          online_at: new Date().toISOString(),
        });
        setState('online');

        // Send online event to API (new contract: type)
        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ type: 'online' }),
        }).catch(() => { });

        // Start heartbeat interval (every 15 seconds)
        heartbeatIntervalRef.current = setInterval(() => {
          fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'heartbeat' }),
          }).catch(() => { });
        }, 15_000);

        // Track user activity for lastActivity
        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity, { passive: true });

        // Send lastActivity periodically (every 30 seconds)
        const activityInterval = setInterval(() => {
          fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'status_change', status: 'Online' }),
          }).catch(() => { });
        }, 30_000);

        return () => {
          clearInterval(heartbeatIntervalRef.current!);
          clearInterval(activityInterval);
          window.removeEventListener('mousemove', handleActivity);
          window.removeEventListener('keydown', handleActivity);
          window.removeEventListener('click', handleActivity);
          window.removeEventListener('scroll', handleActivity);
        };
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setState('offline');
        console.error('[Presence] Channel error:', err);
      }
    });

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        '/api/presence',
        JSON.stringify({ type: 'offline' })
      );

      if (channelRef.current) {
        channelRef.current.untrack();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      if (channelRef.current) {
        channelRef.current.untrack();
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      setState('offline');

      fetch('/api/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'offline' }),
      }).catch(() => { });
    };
  }, [interpreterId, userEmail, handleActivity]);

  return state;
}