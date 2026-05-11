"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { listUsersByRole, createHolder, createInterpreter } from "@/app/actions/rbac-admin";
import toast from "react-hot-toast";

type User = { id: string; email: string; name: string; role: string; createdAt: string };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listUsersByRole(filter || undefined)
      .then(setUsers)
      .catch(() => toast.error("Error"))
      .finally(() => setLoading(false));
  }, [filter]);

  const holders = users.filter((u) => u.role === "HOLDER");
  const interpreters = users.filter((u) => u.role === "INTERPRETER");
  const admins = users.filter((u) => u.role === "ADMIN");

  return (
    <RbacShell requiredRole="ADMIN">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Usuarios</h1>
        <p className="text-slate-400 mt-1">Directorio completo de usuarios del sistema</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "", label: "Todos" },
          { value: "ADMIN", label: "Admins" },
          { value: "HOLDER", label: "Titulares" },
          { value: "INTERPRETER", label: "Intérpretes" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.value
                ? "bg-white/10 text-white border border-white/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
          <p className="text-2xl font-bold text-red-400">{admins.length}</p>
          <p className="text-xs text-slate-400 mt-1">Administradores</p>
        </div>
        <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-4">
          <p className="text-2xl font-bold text-amber-400">{holders.length}</p>
          <p className="text-xs text-slate-400 mt-1">Titulares</p>
        </div>
        <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-4">
          <p className="text-2xl font-bold text-blue-400">{interpreters.length}</p>
          <p className="text-xs text-slate-400 mt-1">Intérpretes</p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Usuario</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Email</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Rol</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-6 py-4"><div className="h-6 bg-white/5 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-medium">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      user.role === "ADMIN" ? "bg-red-500/10 text-red-400" :
                      user.role === "HOLDER" ? "bg-amber-500/10 text-amber-400" :
                      "bg-blue-500/10 text-blue-400"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString("es-DO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RbacShell>
  );
}
