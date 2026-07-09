'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePresenceState, RealtimePresenceJoinPayload, RealtimePresenceLeavePayload } from '@supabase/supabase-js';
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
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  useEffect(() => {
    if (!interpreterId) {
      setState('offline');
      return;
    }

    const client = createClient();
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

        fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'Online' }),
        }).catch(() => { });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setState('offline');
        console.error('[Presence] Channel error:', err);
      }
    });

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        '/api/presence',
        JSON.stringify({ status: 'Offline' })
      );

      if (channelRef.current) {
        channelRef.current.untrack();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

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
        body: JSON.stringify({ status: 'Offline' }),
      }).catch(() => { });
    };
  }, [interpreterId, userEmail]);

  return state;
}
