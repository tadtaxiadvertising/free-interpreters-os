'use client';

import { cn } from '@/lib/utils';
import { usePresenceContext } from '@/contexts/PresenceContext';

export function PresenceBadge() {
  const presence = usePresenceContext();

  if (presence === 'loading') {
    return (
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium',
        'bg-slate-800/50 border-slate-700/50 text-slate-500',
        'animate-pulse'
      )}>
        <div className="w-2 h-2 rounded-full bg-slate-500" />
        Detectando…
      </div>
    );
  }

  if (presence === 'online') {
    return (
      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium',
        'bg-green-500/10 border-green-500/30 text-green-400',
        'transition-all'
      )}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
        • Online
      </div>
    );
  }

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium',
      'bg-slate-800/50 border-slate-700/50 text-slate-400',
      'transition-all'
    )}>
      <div className="w-2 h-2 rounded-full bg-slate-500" />
      • Offline
    </div>
  );
}
