"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { 
  createHolder, 
  createInterpreter, 
  getAdminStats, 
  listUsersByRole, 
  listPendingMessages, 
  moderateMessage 
} from "@/app/actions/rbac-admin";
import { RbacStatCard, RbacStatSkeleton } from "@/components/rbac-dashboard/stat-card";
import { RbacTable } from "@/components/rbac-dashboard/data-table";
import { RbacActionContainer } from "@/components/rbac-dashboard/action-container";
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    getAdminStats().then(setStats).catch(() => {});
    listUsersByRole().then(data => setUsers(data as User[])).catch(() => {});
    listPendingMessages().then(data => setMessages(data as unknown as Message[])).catch(() => {});
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
        loadData();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error al crear usuario";
        toast.error(errorMsg);
      }
    });
  };

  const handleModerate = (messageId: string, action: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      try {
        await moderateMessage({ messageId, action });
        toast.success(`Mensaje ${action === "APPROVED" ? "aprobado" : "rechazado"}`);
        loadData();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Error al moderar";
        toast.error(errorMsg);
      }
    });
  };

  return (
    <RbacShell requiredRole="ADMIN">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Centro de Control</h1>
        <p className="text-slate-400 mt-2 text-lg">Panel de administración global para Free Interpreters OS</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats ? (
          <>
            <RbacStatCard label="Titulares" value={stats.holders} icon="👤" color="from-amber-500 to-orange-600" delay={0} />
            <RbacStatCard label="Intérpretes" value={stats.interpreters} icon="🎧" color="from-blue-500 to-indigo-600" delay={100} />
            <RbacStatCard label="Cuentas Vault" value={stats.accounts} icon="🔐" color="from-emerald-500 to-teal-600" delay={200} />
            <RbacStatCard label="Pendientes" value={stats.pendingMessages} icon="📨" color="from-rose-500 to-pink-600" delay={300} />
          </>
        ) : (
          [1, 2, 3, 4].map((i) => <RbacStatSkeleton key={i} />)
        )}
      </div>

      {/* Action Container */}
      <RbacActionContainer 
        title="Provisionar Nuevo Usuario" 
        description="Añade titulares o intérpretes al sistema de forma segura"
        buttonLabel="+ Nuevo Usuario"
      >
        <div className="flex gap-3 mb-8 bg-white/5 p-1.5 rounded-2xl w-fit">
          {(["HOLDER", "INTERPRETER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-white/10 text-white shadow-lg border border-white/10"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab === "HOLDER" ? "Titular" : "Intérprete"}
            </button>
          ))}
        </div>

        <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormInput name="name" label="Nombre Completo" placeholder="Ej. Juan Pérez" />
          <FormInput name="email" label="Email Corporativo" type="email" placeholder="usuario@freeinterpreters.com" />
          <FormInput name="password" label="Contraseña Temporal" type="password" placeholder="••••••••" />
          <div className="md:col-span-3 pt-2">
            <button
              disabled={pending}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:shadow-2xl hover:shadow-blue-500/40 transition-all disabled:opacity-50"
            >
              {pending ? "Procesando..." : `Confirmar Alta de ${activeTab === "HOLDER" ? "Titular" : "Intérprete"}`}
            </button>
          </div>
        </form>
      </RbacActionContainer>

      <div className="space-y-10">
        {/* Users Table */}
        <RbacTable
          title="Directorio de Usuarios"
          data={users}
          columns={[
            {
              header: "Identidad",
              accessor: (u) => (
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-white border border-white/5`}>
                    {u.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-white">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </div>
                </div>
              ),
            },
            {
              header: "Rol",
              accessor: (u) => (
                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                  u.role === "ADMIN" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                  u.role === "HOLDER" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>
                  {u.role}
                </span>
              ),
            },
            {
              header: "Registro",
              accessor: (u) => (
                <span className="text-slate-400 font-medium">
                  {new Date(u.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              ),
            },
          ]}
        />

        {/* Moderation Table */}
        <RbacTable
          title="Bandeja de Moderación"
          data={messages}
          columns={[
            {
              header: "Tráfico (De → Para)",
              accessor: (m) => (
                <div className="text-xs">
                  <span className="text-white font-bold">{m.author.name}</span>
                  <span className="text-slate-600 mx-2">→</span>
                  <span className="text-slate-400">{m.recipient?.name || "Global"}</span>
                </div>
              ),
            },
            {
              header: "Contenido",
              accessor: (m) => (
                <div className="max-w-xs truncate text-slate-300 bg-white/5 px-3 py-2 rounded-lg border border-white/5" title={m.content}>
                  {m.content}
                </div>
              ),
            },
            {
              header: "Acciones Críticas",
              className: "text-right",
              accessor: (m) => (
                <div className="flex gap-2 justify-end">
                  <button
                    disabled={pending}
                    onClick={() => handleModerate(m.id, "APPROVED")}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all border border-emerald-500/10"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => handleModerate(m.id, "REJECTED")}
                    className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/10"
                  >
                    <XIcon />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </RbacShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function FormInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all shadow-inner"
      />
    </div>
  );
}

function CheckIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
}

function XIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
