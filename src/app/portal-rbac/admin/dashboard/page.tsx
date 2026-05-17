import React from "react";
import { getRbacAdminDashboard } from "@/app/actions/rbac-data";
import {
  Users,
  Phone,
  DollarSign,
  Activity,
  BarChart3,
  TrendingUp,
  ChevronRight,
  Trophy,
  Clock,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getRbacAdminDashboard();

  const STALE_THRESHOLD = 2 * 60 * 1000;
  const nowTime = Date.now();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Executive Command Center
          </h2>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Global Performance Oversight — Portal RBAC
          </p>
        </div>
      </header>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            label: "MTD Hours",
            value: (data.totalMinutesMonth / 60).toFixed(1),
            sub: `Today: ${(data.totalMinutesToday / 60).toFixed(1)}h`,
            icon: Activity,
            color: "text-blue-400",
          },
          {
            label: "MTD Payout",
            value: `RD$${data.totalCostMonth.toLocaleString()}`,
            sub: `Today: RD$${data.totalCostToday.toFixed(2)}`,
            icon: DollarSign,
            color: "text-green-400",
          },
          {
            label: "Active Roster",
            value: data.totalInterpreters,
            sub: `${data.onlineCount} Online Now`,
            icon: Users,
            color: "text-purple-400",
          },
          {
            label: "Live Traffic",
            value: data.activeCalls,
            sub: "Call Sessions",
            icon: Phone,
            color: "text-orange-400",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="glass p-6 rounded-3xl border border-white/5 relative overflow-hidden group flex flex-col justify-between min-h-[160px]"
          >
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon size={80} />
            </div>
            <div
              className={`p-3 rounded-2xl bg-white/5 ${stat.color} w-fit mb-2`}
            >
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white mt-1 leading-none">
                {stat.value}
              </h3>
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
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />{" "}
                  {data.onlineCount} Ready
                </span>
                <span className="text-[10px] uppercase font-bold text-orange-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />{" "}
                  {data.busyCount} Busy
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
                    <th className="py-4 px-6 text-right">MTD Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.interpreterStats.map((interp: any) => {
                    const isStale =
                      nowTime - new Date(interp.updatedAt).getTime() >
                      STALE_THRESHOLD;
                    const status =
                      isStale && interp.realtimeStatus !== "Offline"
                        ? "Disconnected"
                        : interp.realtimeStatus;

                    return (
                      <tr
                        key={interp.id}
                        className="hover:bg-white/5 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <p className="font-bold text-white text-sm">
                            {interp.name}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {interp.externalId}
                          </p>
                        </td>
                        <td className="py-4 px-4 text-gray-400 text-xs">
                          {interp.campaign || "—"}
                        </td>
                        <td className="py-4 px-4 text-indigo-400 font-medium text-sm font-mono">
                          RD${(interp.tariffPerMinute * 60).toFixed(2)}/h
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-2 h-2 rounded-full",
                                status === "Online"
                                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                  : status === "Busy"
                                    ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                                    : status === "Disconnected"
                                      ? "bg-red-500 animate-pulse"
                                      : "bg-gray-600"
                              )}
                            />
                            <span className="text-[10px] text-gray-400 font-bold uppercase">
                              {status}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className="text-white font-bold text-sm">
                            {interp.totalHours.toFixed(1)}h
                          </span>
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
              {data.topPerformers.map((interp: any, i: number) => (
                <div
                  key={interp.id}
                  className="flex items-center justify-between group cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold border border-white/10 group-hover:border-yellow-500/50 transition-colors">
                        {interp.name.charAt(0)}
                      </div>
                      {i === 0 && (
                        <div className="absolute -top-1 -right-1 text-yellow-500 bg-black rounded-full">
                          <Trophy size={12} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm truncate max-w-[100px]">
                        {interp.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Rank #{i + 1}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-xs">
                      {interp.totalHours.toFixed(1)}h
                    </p>
                    <p className="text-[10px] text-indigo-400 font-bold">
                      Total hrs
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Messages Card */}
          {data.pendingMessages > 0 && (
            <Link
              href="/portal-rbac/admin/messages"
              className="glass p-5 rounded-3xl border border-amber-500/20 hover:border-amber-500/40 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <span className="text-white font-bold text-sm">
                    Mensajes Pendientes
                  </span>
                  <p className="text-[10px] text-amber-400">
                    {data.pendingMessages} por moderar
                  </p>
                </div>
              </div>
              <ChevronRight
                size={16}
                className="text-gray-600 group-hover:text-white transition-colors"
              />
            </Link>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-4">
            <Link
              href="/portal-rbac/admin/users"
              className="glass p-5 rounded-3xl border border-white/5 hover:border-blue-500/30 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Users size={18} />
                </div>
                <span className="text-white font-bold text-sm">
                  Gestión de Usuarios
                </span>
              </div>
              <ChevronRight
                size={16}
                className="text-gray-600 group-hover:text-white transition-colors"
              />
            </Link>
            <Link
              href="/portal-rbac/admin/messages"
              className="glass p-5 rounded-3xl border border-white/5 hover:border-indigo-500/30 transition-all group flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <MessageSquare size={18} />
                </div>
                <span className="text-white font-bold text-sm">
                  Moderación de Mensajes
                </span>
              </div>
              <ChevronRight
                size={16}
                className="text-gray-600 group-hover:text-white transition-colors"
              />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
