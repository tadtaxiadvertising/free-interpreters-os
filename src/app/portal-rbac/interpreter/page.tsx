"use client";
import { useEffect, useState } from "react";
import RbacShell from "@/components/rbac-shell";
import { listAssignedAccounts } from "@/app/actions/rbac-interpreter";
import toast from "react-hot-toast";

type AssignedAccount = {
  id: string;
  platformName: string;
  url: string | null;
  vpnConfig: string | null;
  credentials: string;
  notes: string | null;
  holder: { name: string };
  attachments: { id: string; fileName: string; fileUrl: string }[];
};

export default function InterpreterDashboard() {
  const [accounts, setAccounts] = useState<AssignedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreds, setShowCreds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listAssignedAccounts()
      .then(setAccounts)
      .catch(() => toast.error("Error al cargar cuentas asignadas"))
      .finally(() => setLoading(false));
  }, []);

  const toggleCreds = (id: string) => {
    setShowCreds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  return (
    <RbacShell requiredRole="INTERPRETER">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Mis Herramientas</h1>
        <p className="text-slate-400 mt-1">Cuentas y credenciales asignadas por tus titulares</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-3xl bg-white/5 border border-white/5 p-16 text-center">
          <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
          </div>
          <h2 className="text-xl font-semibold text-white">No tienes cuentas asignadas</h2>
          <p className="text-slate-500 mt-2">Contacta a tu Titular para recibir acceso a las plataformas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((acc) => (
            <div key={acc.id} className="group relative rounded-3xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/5 px-2 py-1 rounded">
                  Titular: {acc.holder.name}
                </span>
              </div>
              
              <div className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center border border-blue-500/20 text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{acc.platformName}</h2>
                    {acc.url && (
                      <a href={acc.url} target="_blank" className="text-sm text-blue-400 hover:underline">Acceder a URL →</a>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Credenciales */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Acceso Directo</label>
                      <button onClick={() => toggleCreds(acc.id)} className="text-xs text-blue-400 hover:text-white transition-colors">
                        {showCreds[acc.id] ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                    <div className="relative group/creds">
                      <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-sm text-blue-100 break-all pr-12">
                        {showCreds[acc.id] ? acc.credentials : "••••••••••••••••••••••••"}
                      </div>
                      {showCreds[acc.id] && (
                        <button 
                          onClick={() => copyToClipboard(acc.credentials)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg text-slate-400 transition-all"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* VPN & Notas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {acc.vpnConfig && (
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">VPN Config</span>
                        <p className="text-xs text-slate-300">{acc.vpnConfig}</p>
                      </div>
                    )}
                    {acc.notes && (
                      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas</span>
                        <p className="text-xs text-slate-300">{acc.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  {acc.attachments.length > 0 && (
                    <div className="pt-2">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Archivos Adjuntos</span>
                      <div className="flex flex-wrap gap-2">
                        {acc.attachments.map(att => (
                          <a key={att.id} href={att.fileUrl} target="_blank" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 hover:bg-blue-500/20 transition-all">
                            📎 {att.fileName}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </RbacShell>
  );
}
