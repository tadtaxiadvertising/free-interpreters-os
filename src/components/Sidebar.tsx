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
  ShieldCheck,
  UserPlus,
  Settings,
  Menu,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';

const adminMenu = [
  { icon: LayoutDashboard, label: 'Command Center', href: '/admin' },
  { icon: Users, label: 'Interpreter Roster', href: '/interpreters' },
  { icon: UserPlus, label: 'Recruitment', href: '/recruitment' },
  { icon: ShieldCheck, label: 'Quality Assurance', href: '/qa' },
  { icon: DollarSign, label: 'Payroll & Rates', href: '/payroll' },
  { icon: Settings, label: 'System Settings', href: '/settings' },
];

const interpreterMenu = [
  { icon: LayoutDashboard, label: 'My Dashboard', href: '/dashboard' },
  { icon: Clock, label: 'Active Session', href: '/dashboard' },
  { icon: DollarSign, label: 'My Earnings', href: '/dashboard/earnings' },
  { icon: Settings, label: 'Account Settings', href: '/dashboard/settings' },
];

interface SidebarProps {
  role: UserRole;
  isCollapsed: boolean;
  onToggle: () => void;
  notifications?: any[];
}

export function Sidebar({ role, isCollapsed, onToggle, notifications = [] }: SidebarProps) {
  const pathname = usePathname();
  const menuItems = role === 'admin' ? adminMenu : interpreterMenu;

  return (
    <aside className={cn(
      "sticky top-0 h-screen glass border-r border-white/10 z-50 hidden md:flex flex-col transition-all duration-500 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <div className={cn("p-6 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="animate-in fade-in duration-500">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent truncate">
              Free Interpreters
            </h1>
            <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">
              {role === 'admin' ? 'Admin OS' : 'Portal'}
            </p>
          </div>
        )}
        <button 
          onClick={onToggle}
          className={cn(
            "p-2 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition-all",
            isCollapsed && "hover:scale-110"
          )}
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="mt-6 px-4 space-y-2 flex-1">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              title={isCollapsed ? item.label : ""}
              className={cn(
                "flex items-center p-3 rounded-xl transition-all duration-300 group relative",
                isActive
                  ? "bg-blue-600/20 text-blue-400 glow"
                  : "text-gray-400 hover:bg-white/5 hover:text-white",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className={cn("transition-transform group-hover:scale-110", isActive && "text-blue-400")} />
                {!isCollapsed && <span className="font-medium animate-in fade-in duration-300 truncate">{item.label}</span>}
              </div>
              {!isCollapsed && isActive && <ChevronRight size={16} />}
              {isCollapsed && isActive && (
                <div className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className={cn("p-4 transition-all duration-500", isCollapsed ? "px-2" : "px-4")}>
        <div className={cn(
          "rounded-2xl bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/10 transition-all duration-500",
          isCollapsed ? "p-2 flex flex-col items-center" : "p-4"
        )}>
          {!isCollapsed && <p className="text-xs text-gray-500 animate-in fade-in duration-500">System Status</p>}
          <div className={cn("flex items-center gap-2", !isCollapsed && "mt-2")}>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            {!isCollapsed && (
              <span className="text-sm font-medium text-gray-300 animate-in fade-in duration-500 truncate">
                Edge API Online
              </span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
