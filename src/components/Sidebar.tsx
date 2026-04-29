'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Phone,
  DollarSign,
  ChevronRight,
  Clock,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoutButton } from './LogoutButton';
import type { UserRole } from '@/lib/types';

const adminMenu = [
  { icon: LayoutDashboard, label: 'Command Center', href: '/admin' },
  { icon: Users, label: 'Live Roster', href: '/admin' },
  { icon: DollarSign, label: 'Payrates', href: '/admin/payrates' },
  { icon: Phone, label: 'Call History', href: '/admin/calls' },
];

const interpreterMenu = [
  { icon: LayoutDashboard, label: 'My Dashboard', href: '/dashboard' },
  { icon: Clock, label: 'Call Timer', href: '/dashboard' },
  { icon: History, label: 'My Calls', href: '/dashboard' },
];

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const menuItems = role === 'admin' ? adminMenu : interpreterMenu;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass border-r border-white/10 z-50 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
          Free Interpreters OS
        </h1>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">
          {role === 'admin' ? 'Admin Panel' : 'Interpreter Portal'}
        </p>
      </div>

      <nav className="mt-6 px-4 space-y-2 flex-1">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl transition-all duration-300 group",
                isActive
                  ? "bg-blue-600/20 text-blue-400 glow"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className={cn("transition-transform group-hover:scale-110", isActive && "text-blue-400")} />
                <span className="font-medium">{item.label}</span>
              </div>
              {isActive && <ChevronRight size={16} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 space-y-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/10">
          <p className="text-xs text-gray-500">System Status</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-300">Edge API Online</span>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
