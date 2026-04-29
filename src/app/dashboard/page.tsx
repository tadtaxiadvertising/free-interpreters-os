import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Phone, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { StatusToggle } from '../../components/StatusToggle';
import { CallTimer } from '../../components/CallTimer';
import { CallHistory } from '../../components/CallHistory';

export const dynamic = 'force-dynamic';

export default async function InterpreterDashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('interpreter_id, display_name, role')
    .eq('id', user.id)
    .single();

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

  if (!profile.interpreter_id) {
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

  // Fetch interpreter data
  const { data: interpreter } = await supabase
    .from('interpreters')
    .select('id, name, realtime_status, tariffPerMinute, campaign, languageA, languageB')
    .eq('id', profile.interpreter_id)
    .single();

  if (!interpreter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="glass p-8 rounded-3xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Profile Not Found</h2>
          <p className="text-gray-400">
            We could not find your interpreter profile. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  // Fetch active call (if any)
  const { data: activeCall } = await supabase
    .from('call_sessions')
    .select('id, started_at, tariff_snapshot')
    .eq('interpreter_id', interpreter.id)
    .is('ended_at', null)
    .limit(1)
    .single();

  // Fetch today's stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: todayCalls } = await supabase
    .from('call_sessions')
    .select('duration_seconds, call_cost')
    .eq('interpreter_id', interpreter.id)
    .gte('started_at', todayStart.toISOString())
    .not('ended_at', 'is', null);

  const todayMinutes = Math.round(
    (todayCalls?.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) || 0) / 60
  );
  const todayEarnings = todayCalls?.reduce((sum, c) => sum + (c.call_cost || 0), 0) || 0;
  const todayCallCount = todayCalls?.length || 0;

  // Recent completed calls
  const { data: recentCalls } = await supabase
    .from('call_sessions')
    .select('id, started_at, ended_at, duration_seconds, call_cost, tariff_snapshot')
    .eq('interpreter_id', interpreter.id)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(10);

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
          currentStatus={interpreter.realtime_status}
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
            startedAt: activeCall.started_at,
            tariffSnapshot: activeCall.tariff_snapshot,
          } : null}
          currentRate={Number(interpreter.tariffPerMinute)}
        />
      </div>

      {/* Recent Calls */}
      <CallHistory calls={recentCalls || []} />
    </div>
  );
}
