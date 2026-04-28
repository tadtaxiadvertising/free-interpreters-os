import React from 'react';
import { 
  Users, 
  Clock, 
  Activity, 
  TrendingUp,
  Globe,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

async function getStats() {
  const { count: interpreterCount } = await supabase.from('interpreters').select('*', { count: 'exact', head: true });
  const { data: logs } = await supabase.from('production_logs').select('interpreted_minutes, calls_attended');
  
  const totalMinutes = logs?.reduce((acc, log) => acc + (log.interpreted_minutes || 0), 0) || 0;
  const totalCalls = logs?.reduce((acc, log) => acc + (log.calls_attended || 0), 0) || 0;

  return {
    interpreters: interpreterCount || 0,
    minutes: totalMinutes,
    calls: totalCalls,
    activeNow: interpreterCount || 0, // Placeholder
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const statCards = [
    { label: 'Total Interpreters', value: stats.interpreters, icon: Users, color: 'text-blue-400', trend: '+12%', up: true },
    { label: 'Total Minutes', value: stats.minutes.toLocaleString(), icon: Clock, color: 'text-purple-400', trend: '+5.4%', up: true },
    { label: 'Calls Attended', value: stats.calls.toLocaleString(), icon: Activity, color: 'text-green-400', trend: '-2%', up: false },
    { label: 'Active Sessions', value: stats.activeNow, icon: Globe, color: 'text-orange-400', trend: 'Live', up: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white">Enterprise Overview</h2>
        <p className="text-gray-400">Real-time performance analytics for Free Interpreters</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-current opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity ${stat.color.replace('text', 'bg')}`} />
            
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <div className={cn(
                "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                stat.up ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
              )}>
                {stat.up ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
                {stat.trend}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity / Production Feed */}
        <div className="lg:col-span-2 glass rounded-3xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Recent Production</h3>
            <button className="text-sm text-blue-400 hover:underline">View All</button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-white/5">
                  <th className="pb-4 px-2">Interpreter</th>
                  <th className="pb-4 px-2">Campaign</th>
                  <th className="pb-4 px-2">Minutes</th>
                  <th className="pb-4 px-2">QA Score</th>
                  <th className="pb-4 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[1, 2, 3].map((_, i) => (
                  <tr key={i} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4 px-2 font-medium text-white">Interpreter {i+1}</td>
                    <td className="py-4 px-2 text-gray-400">Medical</td>
                    <td className="py-4 px-2 text-gray-400">120m</td>
                    <td className="py-4 px-2">
                      <span className="px-2 py-1 rounded-lg bg-green-500/10 text-green-400 text-xs font-bold">95%</span>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400">
                        OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / Alerts */}
        <div className="glass rounded-3xl p-8">
          <h3 className="text-xl font-bold text-white mb-6">System Alerts</h3>
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <div className="w-2 h-2 mt-2 rounded-full bg-red-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">Missing QA Scorecard</p>
                <p className="text-xs text-gray-400 mt-1">ID: 104 requires quality review for last session.</p>
              </div>
            </div>
            <div className="flex gap-4 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-white">Payroll Cycle Approaching</p>
                <p className="text-xs text-gray-400 mt-1">Next payment cycle starts in 3 days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility function duplicated for simplicity in this file
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
