import React from 'react';
import { getAdminUsers } from '@/app/actions/admin-users';
import { Shield, User, Link as LinkIcon, Edit, Trash2, Mail } from 'lucide-react';
import { RoleBadge } from '../../../components/RoleBadge';
import { UserActions } from '../../../components/admin/UserActions';
import { SyncUsersButton } from '../../../components/admin/SyncUsersButton';

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

      <div className="glass rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
              <Shield size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Usuarios Registrados</h3>
          </div>
          <span className="text-sm font-medium text-slate-400 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
            {users.length} Usuarios Totales
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-[0.2em] border-b border-white/5">
                <th className="py-6 px-10">Usuario</th>
                <th className="py-6 px-6">Rol de Sistema</th>
                <th className="py-6 px-6">Vínculo de Intérprete</th>
                <th className="py-6 px-6">Fecha Registro</th>
                <th className="py-6 px-10 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user) => (
                <tr key={user.id} className="group hover:bg-white/[0.02] transition-all">
                  <td className="py-6 px-10">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-slate-400 font-bold border border-white/10 group-hover:border-blue-500/30 transition-colors">
                        {user.displayName?.charAt(0) || user.email.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-white text-lg">{user.displayName || 'Sin Nombre'}</p>
                        <p className="text-slate-500 text-sm flex items-center gap-1.5">
                          <Mail size={12} />
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-6">
                    <RoleBadge role={user.role as any} />
                  </td>
                  <td className="py-6 px-6">
                    {user.interpreter ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-400 flex items-center gap-1.5">
                          <LinkIcon size={14} />
                          {user.interpreter.name}
                        </span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                          Campaña: {user.interpreter.campaign || 'N/A'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-600 italic">No vinculado</span>
                    )}
                  </td>
                  <td className="py-6 px-6 text-slate-400 text-sm font-medium">
                    {new Date(user.createdAt!).toLocaleDateString()}
                  </td>
                  <td className="py-6 px-10 text-right">
                    <UserActions user={user} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-24 text-center">
            <User size={64} className="mx-auto text-slate-800 mb-6" />
            <p className="text-slate-500 text-lg font-medium">No se encontraron usuarios registrados.</p>
          </div>
        )}
      </div>
    </div>
  );
}
