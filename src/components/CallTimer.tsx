'use client';

import React, { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { Play, Square, DollarSign, Clock, Loader2 } from 'lucide-react';
import { startCall, endCall } from '@/app/actions/calls';
import type { TimerLocalState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { QuickLogButton } from './QuickLogButton';

const LS_KEY = 'fios_active_call';

interface CallTimerProps {
  activeCall: {
    sessionId: number;
    startedAt: string;
    tariffSnapshot: number;
  } | null;
  currentRate: number;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallTimer({ activeCall, currentRate }: CallTimerProps) {
  const [isActive, setIsActive] = useState(!!activeCall);
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(activeCall?.sessionId ?? null);
  const [tariff, setTariff] = useState(activeCall?.tariffSnapshot ?? currentRate);
  const [callResult, setCallResult] = useState<{ duration: number; cost: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<string | null>(activeCall?.startedAt ?? null);

  // Calculate elapsed from server timestamp (resilient to reload)
  const calculateElapsed = useCallback((startedAt: string) => {
    return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  }, []);

  // Resume from active call (server-provided or localStorage)
  useEffect(() => {
    if (activeCall && activeCall.sessionId !== sessionId) {
      startedAtRef.current = activeCall.startedAt;
      setSessionId(activeCall.sessionId);
      setTariff(activeCall.tariffSnapshot);
      setIsActive(true);
      setElapsed(calculateElapsed(activeCall.startedAt));

      // Sync to localStorage
      const state: TimerLocalState = {
        sessionId: activeCall.sessionId,
        startedAt: activeCall.startedAt,
        interpreterId: 0,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    }
  }, [activeCall, calculateElapsed, sessionId]);

  // Timer tick
  useEffect(() => {
    let animationFrameId: number;
    let lastTick = 0;

    const tick = (timestamp: number) => {
      if (timestamp - lastTick >= 1000) {
        if (startedAtRef.current) {
          setElapsed(calculateElapsed(startedAtRef.current));
        }
        lastTick = timestamp;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isActive && startedAtRef.current) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isActive, calculateElapsed]);

  function handleStart() {
    setCallResult(null);
    startTransition(async () => {
      const result = await startCall();
      if (result.success && result.data) {
        setSessionId(result.data.sessionId);
        startedAtRef.current = result.data.startedAt;
        setTariff(currentRate);
        setIsActive(true);
        setElapsed(0);

        const state: TimerLocalState = {
          sessionId: result.data.sessionId,
          startedAt: result.data.startedAt,
          interpreterId: 0,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      }
    });
  }

  function handleEnd() {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await endCall(sessionId);
      if (result.success && result.data) {
        setIsActive(false);
        setCallResult({
          duration: result.data.durationSeconds,
          cost: result.data.callCost,
        });
        localStorage.removeItem(LS_KEY);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    });
  }

  const estimatedCost = (elapsed / 60) * tariff;

  return (
    <div className="flex flex-col items-center">
      {/* Timer Display */}
      <div className={cn(
        'relative w-64 h-64 rounded-full flex items-center justify-center mb-8 transition-all duration-500',
        isActive
          ? 'bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-2 border-blue-500/30 shadow-[0_0_60px_rgba(59,130,246,0.15)]'
          : 'bg-white/5 border-2 border-white/10'
      )}>
        {isActive && (
          <div className="absolute inset-0 rounded-full border-2 border-blue-400/20 animate-ping" style={{ animationDuration: '3s' }} />
        )}
        <div className="text-center z-10">
          <p className="text-5xl font-mono font-bold text-white tracking-wider">
            {formatTime(elapsed)}
          </p>
          {isActive && (
            <div className="flex items-center justify-center gap-1 mt-3 text-green-400">
              <DollarSign size={14} />
              <span className="text-sm font-medium">${estimatedCost.toFixed(2)}</span>
              <span className="text-xs text-gray-500 ml-1">est.</span>
            </div>
          )}
        </div>
      </div>

      {/* Rate info */}
      <div className="flex items-center gap-2 mb-6 text-slate-300 text-sm">
        <Clock size={14} />
        <span>Tarifa: ${(tariff * 60).toFixed(2)}/hr (${tariff.toFixed(2)}/min)</span>
      </div>

      {/* Control Buttons */}
      <div className="flex gap-4">
        {!isActive ? (
          <div className="flex gap-4">
            <button
              onClick={handleStart}
              disabled={isPending}
              className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white font-bold rounded-2xl hover:from-green-500 hover:to-green-400 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-green-600/20"
            >
              {isPending ? <Loader2 size={20} className="animate-spin" /> : <Play size={20} />}
              Start Call
            </button>
            {/* QuickLogButton moved directly near Start Call */}
            <div className="relative z-[60]">
              <QuickLogButton inline={true} />
            </div>
          </div>
        ) : (
          <button
            onClick={handleEnd}
            disabled={isPending}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-2xl hover:from-red-500 hover:to-red-400 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-red-600/20"
          >
            {isPending ? <Loader2 size={20} className="animate-spin" /> : <Square size={20} />}
            End Call
          </button>
        )}
      </div>

      {/* Call Result */}
      {callResult && (
        <div className="mt-8 glass rounded-2xl p-6 w-full max-w-sm border border-green-500/20 animate-in slide-in-from-bottom-4 duration-500">
          <h4 className="text-sm font-bold text-green-400 mb-3">Call Completed ✓</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-lg font-bold text-white">{formatTime(callResult.duration)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Earnings</p>
              <p className="text-lg font-bold text-green-400">${callResult.cost.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
