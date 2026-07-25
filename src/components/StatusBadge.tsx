'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Clock, Wifi, WifiOff, Phone, Coffee, HelpCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string | null | undefined;
  statusReason?: string | null;
  lastHeartbeat?: string | Date | null;
  statusChangedAt?: string | Date | null;
  showIcon?: boolean;
  showTime?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  dot: string;
  icon: React.ReactNode;
}> = {
  Online: {
    label: 'Online',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    icon: <Wifi size={14} />,
  },
  Busy: {
    label: 'Busy',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    icon: <Phone size={14} />,
  },
  Away: {
    label: 'Ausente',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    dot: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
    icon: <Coffee size={14} />,
  },
  Offline: {
    label: 'Offline',
    color: 'text-slate-500',
    bg: 'bg-slate-500/10 border-slate-500/20',
    dot: 'bg-slate-500',
    icon: <WifiOff size={14} />,
  },
};

const SIZE_CLASSES = {
  sm: { badge: 'px-2 py-0.5 text-[10px] gap-1', dot: 'w-1.5 h-1.5', icon: 'hidden' },
  md: { badge: 'px-2.5 py-1 text-xs gap-1.5', dot: 'w-2 h-2', icon: '' },
  lg: { badge: 'px-3 py-1.5 text-sm gap-2', dot: 'w-2.5 h-2.5', icon: '' },
};

function formatTimeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

function getTimeDescription(date: string | Date | null | undefined, status: string): string {
  if (!date) return '';
  const label = status === 'Offline' ? 'desconectado' : 'activo';
  return `${label} hace ${formatTimeAgo(date)}`;
}

export default function StatusBadge({
  status,
  statusReason,
  lastHeartbeat,
  statusChangedAt,
  showIcon = true,
  showTime = true,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const normalizedStatus = status || 'Offline';
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.Offline;
  const sizes = SIZE_CLASSES[size];

  const timeToShow = normalizedStatus === 'Offline' ? statusChangedAt : lastHeartbeat;
  const timeLabel = showTime ? getTimeDescription(timeToShow, normalizedStatus) : '';
  const reasonLabel = statusReason && statusReason !== 'initial'
    ? statusReason.replace(/_/g, ' ')
    : '';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-all backdrop-blur-sm',
        config.bg,
        config.color,
        sizes.badge,
        size === 'lg' && 'shadow-sm',
        className
      )}
      title={`${config.label}${reasonLabel ? ` — ${reasonLabel}` : ''}${timeLabel ? ` — ${timeLabel}` : ''}`}
    >
      {/* Animated dot */}
      <span
        className={cn(
          'rounded-full animate-pulse',
          config.dot,
          sizes.dot
        )}
      />

      {/* Icon */}
      {showIcon && size !== 'sm' && (
        <span className={cn('opacity-70', sizes.icon)}>
          {config.icon}
        </span>
      )}

      {/* Label */}
      <span className="font-semibold">
        {config.label}
      </span>

      {/* Time */}
      {showTime && timeToShow && size !== 'sm' && (
        <span className="opacity-50 flex items-center gap-0.5 ml-0.5 font-normal">
          <Clock size={10} />
          {formatTimeAgo(timeToShow)}
        </span>
      )}
    </span>
  );
}