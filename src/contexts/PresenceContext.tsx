'use client';

import { createContext, useContext } from 'react';

export type PresenceState = 'loading' | 'online' | 'offline';

export const PresenceContext = createContext<PresenceState>('loading');

export function usePresenceContext(): PresenceState {
  return useContext(PresenceContext);
}
