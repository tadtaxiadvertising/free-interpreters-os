import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Phone, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { StatusToggle } from '../../components/StatusToggle';
import { CallTimer } from '../../components/CallTimer';
import { CallHistory } from '../../components/CallHistory';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function InterpreterDashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

  const profile = await (prisma as any).userProfile.findFirst({
    where: { 
      OR: [
        { id: userId },
        { clerkId: userId }
      ]
    },
    include: {
      interpreter: {
        include: {
          productionLogs: {
            where: {
              date: {
                gte: startOfMonth,
                lte: endOfMonth
              }
            }
          },
          qaScores: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      }
    }
  });

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass p-8 rounded-3xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Profile Not Created</h2>
          <p className="text-gray-400">
            Your user profile could not be found in the system. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  if (profile.role === 'admin') {
    redirect('/admin');
  }

  const interpreter = profile.interpreter;

  if (!interpreter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass p-8 rounded-3xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Account Not Linked</h2>
          <p className="text-gray-400">
            Your account has not been linked to an interpreter profile yet. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  // Fetch active call (if any)
  const activeCall = await prisma.callSession.findFirst({
    where: {
      interpreterId: interpreter.id,
      endedAt: null
    },
    orderBy: { startedAt: 'desc' }
  });

  // Fetch today's stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayCalls = await prisma.callSession.findMany({
    where: {
      interpreterId: interpreter.id,
      startedAt: { gte: todayStart },
      endedAt: { not: null }
    }
  });

  const todayMinutes = Math.round(
    todayCalls.reduce((sum: number, c: any) => sum + (c.durationSeconds || 0), 0) / 60
  );
  const todayEarnings = todayCalls.reduce((sum: number, c: any) => sum + (Number(c.callCost) || 0), 0);
  const todayCallCount = todayCalls.length;

  // Recent completed calls
  const recentCalls = await prisma.callSession.findMany({
    where: {
      interpreterId: interpreter.id,
      endedAt: { not: null }
    },
    orderBy: { startedAt: 'desc' },
    take: 10
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white">Welcome, {interpreter.name}</h2>
          <p className="text-gray-400 mt-1">
            {interpreter.languageA} ↔ {interpreter.languageB}
            {interpreter.campaign && <span className="ml-3 text-blue-400">• {interpreter.campaign}</span>}
          </p>
        </div>
        <StatusToggle
          currentStatus={interpreter.realtimeStatus as any}
        />
      </header>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Today\'s Calls', value: todayCallCount, icon: Phone, color: 'text-green-400' },
          { label: 'Minutes Interpreted', value: `${todayMinutes}m`, icon: Clock, color: 'text-blue-400' },
          { label: 'Earnings Today', value: `$${todayEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-purple-400' },
        ].map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl bg-white/5 ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Call Timer */}
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp size={22} className="text-blue-400" />
          <h3 className="text-xl font-bold text-white">Call Timer</h3>
        </div>
        <CallTimer
          activeCall={activeCall ? {
            sessionId: activeCall.id,
            startedAt: activeCall.startedAt.toISOString(),
            tariffSnapshot: Number(activeCall.tariffSnapshot),
          } : null}
          currentRate={Number(interpreter.tariffPerMinute)}
        />
      </div>

      {/* Recent Calls */}
      <CallHistory 
        calls={recentCalls.map((c: any) => ({
          id: c.id,
          started_at: c.startedAt.toISOString(),
          ended_at: c.endedAt?.toISOString() || null,
          duration_seconds: c.durationSeconds,
          call_cost: Number(c.callCost),
          tariff_snapshot: Number(c.tariffSnapshot)
        }))} 
      />
    </div>
  );
}
