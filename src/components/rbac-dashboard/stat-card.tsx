import React from "react";

interface RbacStatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
}

export function RbacStatCard({ label, value, icon, color, delay = 0 }: RbacStatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/5 p-6 hover:border-white/10 transition-all group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${color} opacity-5 rounded-full -translate-y-6 translate-x-6 group-hover:opacity-10 transition-opacity`} />
      <div className="text-2xl mb-2 grayscale group-hover:grayscale-0 transition-all">{icon}</div>
      <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-sm text-slate-400 mt-1 font-medium">{label}</p>
    </div>
  );
}

export function RbacStatSkeleton() {
  return <div className="h-32 bg-white/5 rounded-2xl animate-pulse border border-white/5" />;
}
