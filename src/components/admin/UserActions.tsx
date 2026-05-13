'use client';

import React, { useState } from 'react';
import { MoreVertical, Shield, Link as LinkIcon, Trash2, Edit } from 'lucide-react';
import { updateUserRole } from '@/app/actions/admin-users';
import { UserProfile } from '@prisma/client';

export function UserActions({ user }: { user: UserProfile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRoleChange = async (newRole: string) => {
    setIsUpdating(true);
    try {
      await updateUserRole(user.id, newRole);
      setIsOpen(false);
    } catch (error) {
      alert('Error updating role');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 hover:bg-white/10 rounded-2xl text-slate-400 hover:text-white transition-all active:scale-90"
      >
        <MoreVertical size={20} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-white/5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 mb-2">Cambiar Rol</p>
              <div className="grid grid-cols-1 gap-1">
                {['admin', 'interpreter', 'recruiter', 'manager'].map((role) => (
                  <button
                    key={role}
                    disabled={isUpdating || user.role === role}
                    onClick={() => handleRoleChange(role)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all disabled:opacity-30"
                  >
                    <Shield size={14} className={user.role === role ? "text-blue-400" : "text-slate-600"} />
                    <span className="capitalize">{role}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-2">
              <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-blue-400 hover:bg-blue-500/10 transition-all">
                <LinkIcon size={16} />
                Vincular ID Intérprete
              </button>
              <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 size={16} />
                Eliminar Acceso
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
