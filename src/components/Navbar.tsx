'use client';

import React, { useState } from 'react';
import { User, LogOut, Settings } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  email?: string;
  notifications?: any[];
}

export function Navbar({ email, notifications = [] }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          
          <NotificationBell initialNotifications={notifications} />

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-white/10" aria-hidden="true" />

          {/* Profile dropdown */}
          <div className="relative">
            <button
              type="button"
              className="-m-1.5 flex items-center p-1.5 focus:outline-none"
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="sr-only">Open user menu</span>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold glow shadow-lg ring-2 ring-white/10">
                {email ? email[0].toUpperCase() : <User size={16} />}
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="ml-4 text-sm font-semibold leading-6 text-white" aria-hidden="true">
                  {email ? email.split('@')[0] : 'User Profile'}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/10 py-2 shadow-2xl ring-1 ring-white/5 focus:outline-none transition-all">
                {email && (
                  <div className="px-4 py-2 border-b border-white/5 mb-1">
                    <p className="text-xs text-gray-400 truncate">{email}</p>
                  </div>
                )}
                <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2">
                  <Settings size={14} /> Settings
                </button>
                <button 
                  onClick={async () => await logout()}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
