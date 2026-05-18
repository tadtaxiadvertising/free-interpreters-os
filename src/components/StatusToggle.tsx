'use client';

import React from 'react';
import { Wifi, WifiOff, Phone } from 'lucide-react';
import type { RealtimeStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  Online:  { label: 'Online',  color: 'text-green-400',  bgColor: 'bg-green-500/20 border-green-500/30', icon: Wifi },
  Offline: { label: 'Offline', color: 'text-gray-400',   bgColor: 'bg-gray-500/20 border-gray-500/30',  icon: WifiOff },
  Busy:    { label: 'Busy',    color: 'text-orange-400', bgColor: 'bg-orange-500/20 border-orange-500/30', icon: Phone },
};

interface StatusToggleProps {
  currentStatus: string;
}

export function StatusToggle({ currentStatus }: StatusToggleProps) {
  // Validamos el estado para evitar fallos si viene algo inesperado
  const statusKey = Object.keys(statusConfig).includes(currentStatus) ? currentStatus : 'Offline';
  const current = statusConfig[statusKey];
  const CurrentIcon = current.icon;

  return (
    <div className="flex items-center gap-3">
      {/* Indicador de estado automático (solo lectura) */}
      <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all', current.bgColor, current.color)}>
        <div className={cn('w-2 h-2 rounded-full', statusKey === 'Online' ? 'bg-green-400 animate-pulse' : statusKey === 'Busy' ? 'bg-orange-400 animate-pulse' : 'bg-gray-500')} />
        <CurrentIcon size={14} />
        {current.label}
      </div>
    </div>
  );
}
