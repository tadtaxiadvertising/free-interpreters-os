"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { getHolderStats, listHolderAccounts, listAvailableInterpreters } from "@/app/actions/rbac-holder";
import { createVaultAccount } from "@/app/actions/vault.actions";
import { RbacStatCard, RbacStatSkeleton } from "@/components/rbac-dashboard/stat-card";
import { RbacTable } from "@/components/rbac-dashboard/data-table";
import { RbacActionContainer } from "@/components/rbac-dashboard/action-container";
import toast from "react-hot-toast";

export default function HolderDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [interpreters, setInterpreters] = useState<any[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    getHolderStats().then(setStats).catch(() => {});
    listHolderAccounts().then(setAccounts).catch(() => {});
    listAvailableInterpreters().then(setInterpreters).catch(() => {});
  };

  const handleCreateAccount = (formData: FormData) => {
    startTransition(async () => {
      const res = await createVaultAccount(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Cuenta de Vault creada con éxito");
        loadData();
      }
    });
  };

  return (
    <RbacShell requiredRole="HOLDER">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Mis Cuentas de Vault</h1>
        <p className="text-slate-400 mt-2 text-lg">Gestiona tus credenciales y asigna intérpretes de forma segura</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {stats ? (
          <>
            <RbacStatCard label="Total de Cuentas" value={stats.totalAccounts} icon="🔐" color="from-blue-500 to-indigo-600" delay={0} />
            <RbacStatCard label="Sin Asignar" value={stats.unassigned} icon="⚠️" color="from-amber-500 to-orange-600" delay={100} />
            <RbacStatCard label="Intérpretes Disponibles" value={interpreters.length} icon="🎧" color="from-emerald-500 to-teal-600" delay={200} />
          </>
        ) : (
          [1, 2, 3].map((i) => <RbacStatSkeleton key={i} />)
        )}
      </div>

      {/* Create Account Section */}
      <RbacActionContainer 
        title="Nueva Cuenta Protegida" 
        description="Encripta credenciales y asígnalas a un intérprete de confianza"
        buttonLabel="+ Añadir Cuenta"
      >
        <form action={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormInput name="platformName" label="Nombre de la Plataforma" placeholder="Ej. Boost Mobile, Verizon..." required />
            <FormInput name="url" label="URL de Acceso" type="url" placeholder="https://..." />
            <FormInput name="vpnConfig" label="Configuración VPN" placeholder="Nombre del servidor o perfil" />
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Credenciales (User/Pass)
              </label>
              <textarea 
                name="credentials" 
                required 
                className="w-full h-32 bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all shadow-inner"
                placeholder="Ingresa los datos sensibles. Serán encriptados inmediatamente."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                Asignar Intérprete
              </label>
              <select 
                name="interpreterId" 
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
              >
                <option value="" className="bg-slate-900 text-slate-500 italic">-- Sin asignar (Solo Titular) --</option>
                {interpreters.map((int) => (
                  <option key={int.id} value={int.id} className="bg-slate-900 text-white">
                    {int.name} ({int.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="md:col-span-2 pt-4">
            <button
              disabled={pending}
              className="w-full md:w-auto px-12 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold hover:shadow-2xl hover:shadow-emerald-500/40 transition-all disabled:opacity-50"
            >
              {pending ? "Encriptando..." : "Guardar en el Vault Seguro"}
            </button>
          </div>
        </form>
      </RbacActionContainer>

      {/* Managed Accounts Table */}
      <RbacTable
        title="Mis Activos de Vault"
        data={accounts}
        columns={[
          {
            header: "Plataforma",
            accessor: (acc) => (
              <div>
                <div className="font-bold text-white">{acc.platformName}</div>
                {acc.url && <a href={acc.url} target="_blank" className="text-xs text-blue-400 hover:underline">{acc.url}</a>}
              </div>
            ),
          },
          {
            header: "Acceso Permitido A",
            accessor: (acc) => (
              acc.interpreter ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-bold text-blue-400">
                    {acc.interpreter.name[0]}
                  </div>
                  <span className="font-medium text-slate-300">{acc.interpreter.name}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-600 bg-white/5 px-2 py-1 rounded-md border border-white/5">Privado (Solo Yo)</span>
              )
            ),
          },
          {
            header: "VPN",
            accessor: (acc) => <span className="text-slate-400 text-xs font-mono">{acc.vpnConfig || "N/A"}</span>,
          },
          {
            header: "Fecha de Creación",
            accessor: (acc) => (
              <span className="text-slate-500 text-xs">
                {new Date(acc.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            ),
          },
        ]}
      />
    </RbacShell>
  );
}

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
