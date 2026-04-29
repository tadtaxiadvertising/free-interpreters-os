import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
  Users, Phone, DollarSign, Activity,
  Wifi, WifiOff, PhoneCall
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/login');

  // Fetch all interpreters with their realtime status
  const { data: interpreters } = await supabase
    .from('interpreters')
    .select('id, name, externalId, realtime_status, tariffPerMinute, campaign, status')
    .eq('status', 'Activo')
    .order('name');

  // Active calls right now
  const { data: activeCalls } = await supabase
    .from('call_sessions')
    .select('id, interpreter_id, started_at, tariff_snapshot')
    .is('ended_at', null);

  // Today's completed calls stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayCalls } = await supabase
    .from('call_sessions')
    .select('duration_seconds, call_cost')
    .gte('started_at', todayStart.toISOString())
    .not('ended_at', 'is', null);

  const totalMinutesToday = Math.round(
    (todayCalls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60
  );
  const totalRevenueToday = todayCalls?.reduce((sum, c) => sum + (c.call_cost || 0), 0) || 0;

  const onlineCount = interpreters?.filter(i => i.realtime_status === 'Online').length || 0;
  const busyCount = interpreters?.filter(i => i.realtime_status === 'Busy').length || 0;

  const activeCallMap = new Map(activeCalls?.map(c => [c.interpreter_id, c]) || []);

  const statusIcon = (s: string) => {
    if (s === 'Online') return <Wifi size={14} className="text-green-400" />;
    if (s === 'Busy') return <PhoneCall size={14} className="text-orange-400" />;
    return <WifiOff size={14} className="text-gray-500" />;
  };

  const statusDot = (s: string) => cn(
    'w-2 h-2 rounded-full',
    s === 'Online' ? 'bg-green-400 animate-pulse' :
    s === 'Busy' ? 'bg-orange-400 animate-pulse' :
    'bg-gray-600'
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white">Admin Command Center</h2>
          <p className="text-gray-400 mt-1">Real-time interpreter operations • {profile.display_name}</p>
        </div>
        <LogoutButton />
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Online Now', value: onlineCount, icon: Wifi, color: 'text-green-400' },
          { label: 'Active Calls', value: activeCalls?.length || 0, icon: Phone, color: 'text-orange-400' },
          { label: 'Minutes Today', value: totalMinutesToday, icon: Activity, color: 'text-blue-400' },
          { label: 'Revenue Today', value: `$${totalRevenueToday.toFixed(2)}`, icon: DollarSign, color: 'text-purple-400' },
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

      {/* Live Roster */}
      <div className="glass rounded-3xl p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users size={22} className="text-blue-400" />
            <h3 className="text-xl font-bold text-white">Live Interpreter Roster</h3>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-400"><div className="w-2 h-2 rounded-full bg-green-400" /> {onlineCount} online</span>
            <span className="flex items-center gap-1 text-orange-400"><div className="w-2 h-2 rounded-full bg-orange-400" /> {busyCount} busy</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2">Interpreter</th>
                <th className="pb-3 px-2">ID</th>
                <th className="pb-3 px-2">Campaign</th>
                <th className="pb-3 px-2">Rate/min</th>
                <th className="pb-3 px-2 text-right">Active Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {interpreters?.map((interp) => {
                const call = activeCallMap.get(interp.id);
                return (
                  <tr key={interp.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className={statusDot(interp.realtime_status)} />
                        {statusIcon(interp.realtime_status)}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-white font-medium">{interp.name}</td>
                    <td className="py-3 px-2 text-gray-500 text-xs font-mono">{interp.externalId}</td>
                    <td className="py-3 px-2 text-gray-400 text-sm">{interp.campaign || '—'}</td>
                    <td className="py-3 px-2 text-blue-400 font-medium">${Number(interp.tariffPerMinute).toFixed(2)}</td>
                    <td className="py-3 px-2 text-right">
                      {call ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium animate-pulse">
                          <Phone size={12} /> Live
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <a href="/admin/payrates" className="glass rounded-3xl p-6 hover:bg-white/5 transition-all group">
          <div className="flex items-center gap-3">
            <DollarSign size={24} className="text-purple-400 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="text-white font-bold">Manage Payrates</h4>
              <p className="text-gray-500 text-sm">Update interpreter tariffs with audit trail</p>
            </div>
          </div>
        </a>
        <a href="/admin/calls" className="glass rounded-3xl p-6 hover:bg-white/5 transition-all group">
          <div className="flex items-center gap-3">
            <Phone size={24} className="text-green-400 group-hover:scale-110 transition-transform" />
            <div>
              <h4 className="text-white font-bold">Call History</h4>
              <p className="text-gray-500 text-sm">Full call log with billing details</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
