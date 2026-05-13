"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { createHolder, createInterpreter, getAdminStats, listUsersByRole, listPendingMessages, moderateMessage } from "@/app/actions/rbac-admin";
import type { RbacRole } from "@prisma/client";
import toast from "react-hot-toast";

type Stats = { holders: number; interpreters: number; accounts: number; pendingMessages: number };
type User = { id: string; email: string; name: string; role: RbacRole | string; createdAt: Date | string };
type Message = { id: string; content: string; createdAt: Date | string; author: User; recipient: User | null; };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"HOLDER" | "INTERPRETER">("HOLDER");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    getAdminStats().then(setStats).catch(() => {});
    listUsersByRole().then(data => setUsers(data as any)).catch(() => {});
    listPendingMessages().then(data => setMessages(data as any)).catch(() => {});
  };

  const handleCreate = (formData: FormData) => {
    startTransition(async () => {
      try {
        const data = Object.fromEntries(formData);
        if (activeTab === "HOLDER") {
          await createHolder(data);
          toast.success("Titular creado exitosamente");
        } else {
          await createInterpreter(data);
          toast.success("Intérprete creado exitosamente");
        }
        setShowForm(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Error al crear usuario");
      }
    });
  };

  const handleModerate = (messageId: string, action: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      try {
        await moderateMessage({ messageId, action });
        toast.success(`Mensaje ${action === "APPROVED" ? "aprobado" : "rechazado"}`);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Error al moderar");
      }
    });
  };

  const statCards = stats
    ? [
        { label: "Titulares", value: stats.holders, color: "from-amber-500 to-orange-600", icon: "👤" },
        { label: "Intérpretes", value: stats.interpreters, color: "from-blue-500 to-indigo-600", icon: "🎧" },
        { label: "Cuentas Vault", value: stats.accounts, color: "from-emerald-500 to-teal-600", icon: "🔐" },
        { label: "Mensajes Pendientes", value: stats.pendingMessages, color: "from-rose-500 to-pink-600", icon: "📨" },
      ]
    : [];

  return (
    <RbacShell requiredRole="ADMIN">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Centro de Control</h1>
        <p className="text-slate-400 mt-1">Gestión de usuarios, cuentas y moderación de mensajes</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats ? statCards.map((card, i) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/5 p-6 hover:border-white/10 transition-all group"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-10 rounded-full -translate-y-6 translate-x-6 group-hover:opacity-20 transition-opacity`} />
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
            <p className="text-sm text-slate-400 mt-1">{card.label}</p>
          </div>
        )) : (
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))
        )}
      </div>

      {/* Create User Section */}
      <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden mb-8">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Provisionar Usuario</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            {showForm ? "Cancelar" : "+ Nuevo Usuario"}
          </button>
        </div>

        {showForm && (
          <div className="p-6">
            {/* Role Tabs */}
            <div className="flex gap-2 mb-6">
              {(["HOLDER", "INTERPRETER"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-white/10 text-white border border-white/10"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab === "HOLDER" ? "Titular" : "Intérprete"}
                </button>
              ))}
            </div>

            <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre Completo
                </label>
                <input
                  name="name"
                  required
                  placeholder="Juan Pérez"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="usuario@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Contraseña
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mín. 8 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                />
              </div>
              <div className="md:col-span-3">
                <button
                  disabled={pending}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50"
                >
                  {pending ? "Creando..." : `Crear ${activeTab === "HOLDER" ? "Titular" : "Intérprete"}`}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Usuarios Registrados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Nombre</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Email</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Rol</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Creado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        user.role === "ADMIN" ? "bg-red-500/20 text-red-400" :
                        user.role === "HOLDER" ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400"
                      }`}>
                        {user.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      user.role === "ADMIN" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      user.role === "HOLDER" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {user.role === "ADMIN" ? "Admin" : user.role === "HOLDER" ? "Titular" : "Intérprete"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No hay usuarios registrados aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Message Moderation Inbox */}
      <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden mt-8">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Bandeja de Moderación</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Autor</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Destinatario</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Mensaje</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => (
                <tr key={msg.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-300">
                    <span className="font-semibold">{msg.author.name}</span><br />
                    <span className="text-xs text-slate-500">{msg.author.role}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {msg.recipient ? (
                      <>
                        <span className="font-semibold">{msg.recipient.name}</span><br />
                        <span className="text-xs text-slate-500">{msg.recipient.role}</span>
                      </>
                    ) : (
                      <span className="text-slate-500 italic">Todos</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-300 bg-white/5 p-3 rounded-xl border border-white/5 line-clamp-2" title={msg.content}>
                      {msg.content}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        disabled={pending}
                        onClick={() => handleModerate(msg.id, "APPROVED")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        disabled={pending}
                        onClick={() => handleModerate(msg.id, "REJECTED")}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No hay mensajes pendientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </RbacShell>
  );
}
