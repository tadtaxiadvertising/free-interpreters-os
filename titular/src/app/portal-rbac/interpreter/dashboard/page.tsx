"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import { getInterpreterAccounts } from "@/app/actions/rbac-interpreter";
import { RbacStatCard, RbacStatSkeleton } from "@/components/rbac-dashboard/stat-card";
import toast from "react-hot-toast";

export default function InterpreterDashboard() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCredentials, setVisibleCredentials] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    getInterpreterAccounts()
      .then(setAccounts)
      .catch(() => toast.error("Error al cargar cuentas asignadas"))
      .finally(() => setLoading(false));
  };

  const toggleVisibility = (id: string) => {
    setVisibleCredentials(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <RbacShell requiredRole="INTERPRETER">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Cuentas Asignadas</h1>
        <p className="text-slate-400 mt-2 text-lg">Accede a las credenciales encriptadas para tus sesiones de interpretación</p>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {!loading ? (
          <>
            <RbacStatCard label="Cuentas Activas" value={accounts.length} icon="🔑" color="from-blue-500 to-indigo-600" />
            <RbacStatCard label="Pendientes de Revisión" value={0} icon="🕒" color="from-amber-500 to-orange-600" delay={100} />
          </>
        ) : (
          [1, 2].map(i => <RbacStatSkeleton key={i} />)
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : accounts.length === 0 ? (
          <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-20 text-center">
            <div className="text-4xl mb-4 opacity-20">📭</div>
            <p className="text-slate-500 font-medium">No tienes cuentas de acceso asignadas en este momento.</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div key={acc.id} className="group relative bg-white/[0.03] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              
              <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{acc.platformName}</h2>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Asignado por: {acc.holder.name}
                    </span>
                  </div>
                  {acc.url && (
                    <a href={acc.url} target="_blank" className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                      {acc.url}
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    </a>
                  )}

                  <div className="mt-8 space-y-6">
                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Credenciales de Acceso</span>
                        <button 
                          onClick={() => toggleVisibility(acc.id)}
                          className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-all flex items-center gap-1.5"
                        >
                          {visibleCredentials[acc.id] ? "Ocultar Datos" : "Revelar Credenciales"}
                          {visibleCredentials[acc.id] ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      <div className={`relative rounded-2xl border transition-all duration-300 ${visibleCredentials[acc.id] ? 'bg-black border-blue-500/30' : 'bg-white/5 border-white/5'}`}>
                        <pre className={`p-5 font-mono text-sm overflow-x-auto transition-all duration-300 ${visibleCredentials[acc.id] ? 'text-blue-400' : 'text-slate-700 blur-sm select-none'}`}>
                          {visibleCredentials[acc.id] ? acc.decryptedCredentials : "••••••••••••••••••••••••••••••••"}
                        </pre>
                        {visibleCredentials[acc.id] && (
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(acc.decryptedCredentials);
                              toast.success("Copiado al portapapeles");
                            }}
                            className="absolute top-3 right-3 p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all"
                          >
                            <CopyIcon />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {acc.vpnConfig && (
                        <div>
                          <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Configuración VPN</span>
                          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-slate-300 text-sm font-medium">
                            {acc.vpnConfig}
                          </div>
                        </div>
                      )}
                      {acc.notes && (
                        <div>
                          <span className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Notas del Titular</span>
                          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-amber-200/70 text-sm italic">
                            {acc.notes}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </RbacShell>
  );
}

function EyeIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>;
}

function EyeOffIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>;
}

function CopyIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}
