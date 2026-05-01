'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';

interface RankingData {
  position: number;
  totalInterpreters: number;
  myMinutes: number;
  avgMinutes: number;
}

interface DashboardShellProps {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
  notifications?: any[];
  ranking?: RankingData | null;
}

export function DashboardShell({ children, role, userName, notifications = [], ranking = null }: DashboardShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  return (
    <div className="flex min-h-screen w-full bg-[#0a0f1c] overflow-hidden">
      <Sidebar 
        role={role} 
        isCollapsed={isCollapsed} 
        onToggle={handleToggle} 
        notifications={notifications}
        ranking={ranking}
      />
      
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <Navbar email={userName} notifications={notifications} />
        
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar transition-all duration-500 relative">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
