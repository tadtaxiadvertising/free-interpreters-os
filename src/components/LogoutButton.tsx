'use client';

import React from 'react';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </form>
  );
}
