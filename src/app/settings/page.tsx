import React from 'react';
import Link from 'next/link';
import { 
  Settings, 
  Database, 
  Shield, 
  User, 
  Globe, 
  Bell, 
  CheckCircle2,
  AlertCircle,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h2 className="text-3xl font-bold text-white">Settings</h2>
        <p className="text-gray-400">System configuration and platform management</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Sidebar (Local to page) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass p-4 rounded-3xl border border-white/5 space-y-1">
            {[
              { icon: User, label: 'Account Profile', active: true },
              { icon: Database, label: 'Database & Sync', active: false },
              { icon: Shield, label: 'Security & Access', active: false },
              { icon: Globe, label: 'Platform Branding', active: false },
              { icon: Bell, label: 'Notifications', active: false },
            ].map((item, idx) => (
              <button
                key={idx}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                  item.active ? "bg-blue-600/20 text-blue-400" : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={18} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="glass p-6 rounded-3xl border border-white/5">
            <h4 className="text-sm font-bold text-white mb-4">Infrastructure Status</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Prisma 7 Engine</span>
                <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Postgres Adapter</span>
                <span className="text-[10px] font-bold bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">CONNECTED</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">SSL Encryption</span>
                <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">ENABLED</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Database Section */}
          <section className="glass p-8 rounded-3xl border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Database size={120} />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Database className="text-blue-400" />
                Data Connection
              </h3>
              <p className="text-gray-400 text-sm mt-1">Manage your Supabase/PostgreSQL connection and migration state.</p>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Primary Database</p>
                  <p className="text-white mt-1 font-mono text-xs truncate">db.kzbkygppplknynrwmtmf.supabase.co</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Migration Version</p>
                  <p className="text-white mt-1 font-mono text-xs">20240428_prisma7_init</p>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20">
                  <RefreshCw size={16} />
                  Test Connection
                </button>
                <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/10">
                  View Schema
                </button>
              </div>
            </div>
          </section>

          {/* Maintenance Section */}
          <section className="glass p-8 rounded-3xl border border-white/5">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <HardDrive className="text-yellow-400" />
              Maintenance & Tools
            </h3>
            
            <div className="mt-6 space-y-4">
              <Link href="/settings/import" className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Database size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Import CSV Data</p>
                    <p className="text-xs text-gray-500">Migrate legacy interpreters and production logs.</p>
                  </div>
                </div>
                <CheckCircle2 size={18} className="text-gray-700 group-hover:text-blue-400 transition-colors" />
              </Link>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Reset Application Cache</p>
                    <p className="text-xs text-gray-500">Clear Next.js data cache and Prisma internal cache.</p>
                  </div>
                </div>
                <CheckCircle2 size={18} className="text-gray-700 group-hover:text-red-400 transition-colors" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
