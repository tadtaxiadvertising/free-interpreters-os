import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  Users, Phone, DollarSign, Activity,
  BarChart3, TrendingUp, ChevronRight, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import prismaClient from '@/lib/prisma';
import { GlobalGoalsButton } from '@/components/GlobalGoalsButton';
import { getSystemConfig } from '@/app/actions/settings';
const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  let profile: any = null;
  try {
    profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { role: true, displayName: true }
    });
  } catch (error) {
    console.error('❌ ADMIN: Profile fetch failed:', error);
  }

  // Fallback check if DB is down but we have a session
  if (!profile && process.env.NODE_ENV === 'production') {
    // In production, if DB is down, we can't verify admin role safely
    // but we can at least show a maintenance message or allow read-only
    console.warn('⚠️ ADMIN: Running in limited mode (No Database)');
  }

  if (profile && profile.role !== 'admin') {
    redirect('/dashboard');
  }

  // Time calculations
  const now = new Date();
  const todayStart = new Date(now.setHours(0,0,0,0));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch Data with Error Handling
  let interpreters: any[] = [];
  let activeCalls: any[] = [];
  let todaySessions: any[] = [];
  let monthSessions: any[] = [];
  let allProductionLogs: any[] = [];

  try {
    [interpreters, activeCalls, todaySessions, monthSessions, allProductionLogs] = await Promise.all([
      prisma.interpreter.findMany({ 
        orderBy: { name: 'asc' },
        include: { productionLogs: { where: { date: { gte: monthStart } } } }
      }),
      prisma.callSession.findMany({ where: { endedAt: null }, include: { interpreter: true } }),
      prisma.callSession.findMany({ where: { startedAt: { gte: todayStart } } }),
      prisma.callSession.findMany({ where: { startedAt: { gte: monthStart }, endedAt: { not: null } } }),
      prisma.productionLog.findMany({ where: { date: { gte: monthStart } } })
    ]);
  } catch (error) {
    console.error('❌ ADMIN: Database fetch failed:', error);
  }

  // Fetch Global Goal
  const globalGoalHours = parseFloat(await getSystemConfig('standard_monthly_goal_hours', '120'));
  const globalGoalMinutes = globalGoalHours * 60;

  // Calculate Ranking
  const interpreterStats = interpreters.map(interp => {
    const sessionMinutes = Math.round(
      monthSessions
        .filter((s: any) => s.interpreterId === interp.id)
        .reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0) / 60
    );
    const logMinutes = allProductionLogs
      .filter((l: any) => l.interpreterId === interp.id)
      .reduce((sum: number, l: any) => sum + (l.interpretedMinutes || 0), 0);
    
    const totalMinutes = sessionMinutes + logMinutes;
    const totalHours = totalMinutes / 60;
    
    return {
      ...interp,
      totalMinutes,
      totalHours,
      sessionMinutes,
      logMinutes
    };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes);

  const topPerformers = interpreterStats.slice(0, 5);

  // Aggregations
  const totalMinutesToday = Math.round(todaySessions.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0) / 60);
  const totalCostToday = todaySessions.reduce((sum: number, s: any) => sum + Number(s.callCost || 0), 0);
  
  const totalMinutesMonth = interpreterStats.reduce((sum, i) => sum + i.totalMinutes, 0);
  const totalCostMonth = monthSessions.reduce((sum: number, s: any) => sum + Number(s.callCost || 0), 0);

  const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes
  const nowTime = new Date().getTime();

  const onlineCount = interpreters.filter((i: any) => 
    i.realtimeStatus === 'Online' && 
    (nowTime - new Date(i.updatedAt).getTime() < STALE_THRESHOLD)
  ).length;

  const busyCount = interpreters.filter((i: any) => i.realtimeStatus === 'Busy').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Executive Command Center</h2>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Global Performance Oversight • {profile?.displayName || 'Administrator'}
          </p>
        </div>
        <div className="flex gap-3">
           <GlobalGoalsButton initialGoal={globalGoalHours} />
        </div>
      </header>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'MTD Hours', value: (totalMinutesMonth / 60).toFixed(1), sub: `Today: ${(totalMinutesToday / 60).toFixed(1)}h`, icon: Activity, color: 'text-blue-400' },
          { label: 'MTD Payout', value: `RD$${totalCostMonth.toLocaleString()}`, sub: `Today: RD$${totalCostToday.toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Active Roster', value: interpreters.length, sub: `${onlineCount} Online Now`, icon: Users, color: 'text-purple-400' },
          { label: 'Live Traffic', value: activeCalls.length, sub: 'Call Sessions', icon: Phone, color: 'text-orange-400' },
        ].map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-[160px]">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={80} />
            </div>
            <div className={`p-3 rounded-2xl bg-white/5 ${stat.color} w-fit mb-2`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white mt-1 leading-none">{stat.value}</h3>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <TrendingUp size={12} className="text-green-400" />
                {stat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Live Roster - 2/3 width */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <BarChart3 size={20} className="text-blue-400" />
                Live Interpreter Roster
              </h3>
              <div className="flex gap-4">
                <span className="text-[10px] uppercase font-bold text-green-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> {onlineCount} Ready
                </span>
                <span className="text-[10px] uppercase font-bold text-orange-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> {busyCount} Busy
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/[0.01] text-gray-500 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-4 px-6">Interpreter</th>
                    <th className="py-4 px-4">Campaign</th>
                    <th className="py-4 px-4">Hourly Rate</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-6 text-right">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {interpreterStats.map((interp: any) => {
                    const isActive = activeCalls.some((c: any) => c.interpreterId === interp.id);
                    return (
                      <tr key={interp.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-4 px-6">
                          <p className="font-bold text-white text-sm">{interp.name}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{interp.externalId}</p>
                        </td>
                        <td className="py-4 px-4 text-gray-400 text-xs">{interp.campaign || '—'}</td>
                        <td className="py-4 px-4 text-indigo-400 font-medium text-sm font-mono">RD${(Number(interp.tariffPerMinute) * 60).toFixed(2)}/h</td>
                        <td className="py-4 px-4">
                          {(() => {
                            const isStale = (nowTime - new Date(interp.updatedAt).getTime() > STALE_THRESHOLD);
                            const status = isStale && interp.realtimeStatus !== 'Offline' ? 'Disconnected' : interp.realtimeStatus;
                            
                            return (
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  status === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                  status === 'Busy' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 
                                  status === 'Disconnected' ? 'bg-red-500 animate-pulse' : 'bg-gray-600'
                                )} />
                                <span className="text-[10px] text-gray-400 font-bold uppercase">{status}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {isActive ? (
                            <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase animate-pulse border border-orange-500/20">
                              On Call
                            </span>
                          ) : (
                            <span className="text-gray-600 text-[10px]">Idle</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Performers - 1/3 width */}
        <div className="space-y-6">
          <div className="glass p-6 rounded-3xl border border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-3 mb-6">
              <Trophy size={20} className="text-yellow-500" />
              Monthly Ranking
            </h3>
            
            <div className="space-y-6">
              {topPerformers.map((interp: any, i: number) => (
                <div key={interp.id} className="flex items-center justify-between group cursor-default">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold border border-white/10 group-hover:border-yellow-500/50 transition-colors">
                        {interp.name.charAt(0)}
                      </div>
                      {i === 0 && <div className="absolute -top-1 -right-1 text-yellow-500 bg-black rounded-full"><Trophy size={12} /></div>}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-[100px]">{interp.name}</p>
                      <p className="text-[10px] text-gray-500">Rank #{i + 1}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-xs">{interp.totalHours.toFixed(1)}h</p>
                    <p className="text-[10px] text-indigo-400 font-bold">Total hrs</p>
                  </div>
                </div>
              ))}
            </div>
            
            <a 
              href="/dashboard/ranking"
              className="w-full mt-8 py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl text-xs font-bold transition-all border border-white/10 flex items-center justify-center"
            >
              View Full Leaderboard
            </a>
          </div>

          {/* Goals Management */}
          <div className="glass p-6 rounded-3xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4">Interpreter Goals</h3>
            <div className="space-y-4">
               <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                  <p className="text-xs text-gray-400 mb-1">Standard Monthly Goal</p>
                  <p className="text-xl font-bold text-white">{globalGoalHours.toFixed(1)} Hours</p>
               </div>
               <a 
                 href="/interpreters"
                 className="w-full py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold hover:bg-indigo-600/30 transition-all flex items-center justify-center"
               >
                 Configure Per-Interpreter
               </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4">
            <a href="/payroll" className="glass p-5 rounded-3xl border border-white/5 hover:border-indigo-500/30 transition-all group flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <DollarSign size={18} />
                </div>
                <span className="text-white font-bold text-sm">Run Payroll</span>
              </div>
              <ChevronRight size={16} className="text-gray-600 group-hover:text-white transition-colors" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
