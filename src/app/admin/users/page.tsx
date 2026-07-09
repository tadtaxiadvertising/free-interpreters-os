import React from 'react';
import { getAdminUsers } from '@/app/actions/admin-users';
import { SyncUsersButton } from '../../../components/admin/SyncUsersButton';
import { AdminUsersClientTable } from '../../../components/admin/AdminUsersClientTable';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex justify-between items-center bg-slate-950/20 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Gestión de Usuarios</h2>
          <p className="text-slate-400 text-sm mt-1">Administra los roles y vinculaciones de acceso del sistema</p>
        </div>
        <SyncUsersButton />
      </header>

      <AdminUsersClientTable users={users} />
    </div>
  );
}
