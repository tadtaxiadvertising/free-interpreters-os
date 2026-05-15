'use client';

import React, { useState, useTransition } from 'react';
import { Wifi, WifiOff, Phone } from 'lucide-react';
import { updateInterpreterStatus } from '@/app/actions/status';
import type { RealtimeStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<RealtimeStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  Online:  { label: 'Online',  color: 'text-green-400',  bgColor: 'bg-green-500/20 border-green-500/30', icon: Wifi },
  Offline: { label: 'Offline', color: 'text-gray-400',   bgColor: 'bg-gray-500/20 border-gray-500/30',  icon: WifiOff },
  Busy:    { label: 'Busy',    color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30', icon: Phone },
};

interface StatusToggleProps {
  currentStatus: string;
}

export function StatusToggle({ currentStatus }: StatusToggleProps) {
  const [status, setStatus] = useState<RealtimeStatus>(currentStatus as RealtimeStatus);
  const [isPending, startTransition] = useTransition();

  function handleToggle(newStatus: RealtimeStatus) {
    if (newStatus === status || isPending) return;
    setStatus(newStatus); // Optimistic
    startTransition(async () => {
      const result = await updateInterpreterStatus(newStatus);
      if (!result.success) {
        setStatus(status); // Revert on failure
      }
    });
  }

  const current = statusConfig[status];
  const CurrentIcon = current.icon;

  return (
    <div className="flex items-center gap-3">
      {/* Current status badge */}
      <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all', current.bgColor, current.color)}>
        <div className={cn('w-2 h-2 rounded-full', status === 'Online' ? 'bg-green-400 animate-pulse' : status === 'Busy' ? 'bg-orange-400 animate-pulse' : 'bg-gray-500')} />
        <CurrentIcon size={14} />
        {current.label}
      </div>

      {/* Toggle buttons */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {(Object.keys(statusConfig) as RealtimeStatus[]).map((s) => {
          const Icon = statusConfig[s].icon;
          const isActive = s === status;
          return (
            <button
              key={s}
              onClick={() => handleToggle(s)}
              disabled={isPending || isActive}
              className={cn(
                'p-2 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-gray-500 hover:text-white hover:bg-white/5',
                isPending && 'opacity-50 cursor-not-allowed'
              )}
              title={s}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
