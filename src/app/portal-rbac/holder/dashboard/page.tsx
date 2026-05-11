"use client";
import { useEffect, useState, useTransition } from "react";
import RbacShell from "@/components/rbac-shell";
import {
  uploadAccount,
  listHolderAccounts,
  assignInterpreter,
  listAvailableInterpreters,
  deleteAccount,
  revealHolderCredentials,
} from "@/app/actions/rbac-holder";
import toast from "react-hot-toast";

type Account = {
  id: string;
  platformName: string;
  url: string | null;
  vpnConfig: string | null;
  credentials: string;
  notes: string | null;
  interpreterId: string | null;
  interpreter: { id: string; name: string; email: string } | null;
  attachments: { id: string; fileName: string; fileUrl: string; uploadedAt: string }[];
  createdAt: string;
};

type Interpreter = { id: string; name: string; email: string };

export default function HolderDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [interpreters, setInterpreters] = useState<Interpreter[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [revealedCreds, setRevealedCreds] = useState<Record<string, string>>({});
  const [loadingCreds, setLoadingCreds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      listHolderAccounts().then(setAccounts),
      listAvailableInterpreters().then(setInterpreters),
    ])
      .catch(() => toast.error("Error al cargar datos"))
      .finally(() => setLoading(false));
  };

  const handleUpload = (formData: FormData) => {
    startTransition(async () => {
      try {
        const data = Object.fromEntries(formData);
        await uploadAccount(data);
        toast.success("Cuenta añadida al Vault");
        setShowForm(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Error al guardar");
      }
    });
  };

  const handleAssign = (accountId: string, interpreterId: string) => {
    if (!interpreterId) return;
    startTransition(async () => {
      try {
        await assignInterpreter({ accountId, interpreterId });
        toast.success("Intérprete asignado");
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Error de asignación");
      }
    });
  };

  const handleDelete = (accountId: string) => {
    if (!confirm("¿Eliminar esta cuenta del Vault?")) return;
    startTransition(async () => {
      try {
        await deleteAccount(accountId);
        toast.success("Cuenta eliminada");
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Error");
      }
    });
  };

  const toggleCreds = async (id: string) => {
    if (revealedCreds[id]) {
      setRevealedCreds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setLoadingCreds((prev) => ({ ...prev, [id]: true }));
    try {
      const plaintext = await revealHolderCredentials(id);
      setRevealedCreds((prev) => ({ ...prev, [id]: plaintext }));
    } catch (err: any) {
      toast.error(err.message || "Error al revelar credenciales");
    } finally {
      setLoadingCreds((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <RbacShell requiredRole="HOLDER">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Data Vault</h1>
          <p className="text-slate-400 mt-1">Gestiona cuentas, credenciales e intérpretes asignados</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all"
        >
          {showForm ? "✕ Cancelar" : "+ Nueva Cuenta"}
        </button>
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="rounded-2xl bg-white/5 border border-amber-500/20 p-6 mb-8 animate-in">
          <h2 className="text-lg font-semibold text-white mb-4">Añadir Cuenta al Vault</h2>
          <form action={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Plataforma *
              </label>
              <input
                name="platformName"
                required
                placeholder="Zoom, Webex, Teams..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                URL de Acceso
              </label>
              <input
                name="url"
                type="url"
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Credenciales *
              </label>
              <input
                name="credentials"
                required
                placeholder="usuario:contraseña"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Configuración VPN
              </label>
              <input
                name="vpnConfig"
                placeholder="Servidor, protocolo..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Notas Adicionales
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Instrucciones especiales..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Asignar Intérprete (opcional)
              </label>
              <select
                name="interpreterId"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
              >
                <option value="">Sin asignar</option>
                {interpreters.map((interp) => (
                  <option key={interp.id} value={interp.id}>
                    {interp.name} ({interp.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button
                disabled={pending}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
              >
                {pending ? "Guardando..." : "🔐 Guardar en Vault"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <p className="text-2xl font-bold text-amber-400">{accounts.length}</p>
          <p className="text-xs text-slate-400 mt-1">Cuentas en Vault</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <p className="text-2xl font-bold text-emerald-400">{accounts.filter((a) => a.interpreterId).length}</p>
          <p className="text-xs text-slate-400 mt-1">Asignadas</p>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/5 p-4">
          <p className="text-2xl font-bold text-slate-400">{accounts.filter((a) => !a.interpreterId).length}</p>
          <p className="text-xs text-slate-400 mt-1">Sin asignar</p>
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/5 p-12 text-center">
          <div className="text-4xl mb-4">🔐</div>
          <p className="text-slate-400">Tu Vault está vacío. Añade la primera cuenta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden hover:border-amber-500/20 transition-all group"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm">
                    {account.platformName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{account.platformName}</h3>
                    {account.url && (
                      <a href={account.url} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline truncate block max-w-[200px]">
                        {account.url}
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                  title="Eliminar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>

              {/* Card Body */}
              <div className="p-5 space-y-3">
                {/* Credentials (masked toggle) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Credenciales</span>
                    <button
                      onClick={() => toggleCreds(account.id)}
                      disabled={loadingCreds[account.id]}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {loadingCreds[account.id] ? "Descifrando..." : revealedCreds[account.id] ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <code className="block bg-black/30 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono min-h-[35px] flex items-center break-all">
                    {revealedCreds[account.id] ? revealedCreds[account.id] : "••••••••••••••••"}
                  </code>
                </div>

                {/* VPN Config */}
                {account.vpnConfig && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">VPN</span>
                    <p className="text-xs text-slate-400 mt-1">{account.vpnConfig}</p>
                  </div>
                )}

                {/* Notes */}
                {account.notes && (
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Notas</span>
                    <p className="text-xs text-slate-400 mt-1">{account.notes}</p>
                  </div>
                )}

                {/* Interpreter Assignment */}
                <div className="pt-2 border-t border-white/5">
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
                    Intérprete Asignado
                  </span>
                  {account.interpreter ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                        {account.interpreter.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-white">{account.interpreter.name}</span>
                      <span className="text-xs text-slate-500">{account.interpreter.email}</span>
                    </div>
                  ) : (
                    <select
                      onChange={(e) => handleAssign(account.id, e.target.value)}
                      disabled={pending}
                      defaultValue=""
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    >
                      <option value="" disabled>Seleccionar intérprete...</option>
                      {interpreters.map((interp) => (
                        <option key={interp.id} value={interp.id}>
                          {interp.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Attachments */}
                {account.attachments.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
                      Archivos ({account.attachments.length})
                    </span>
                    <div className="space-y-1">
                      {account.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener"
                          className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          📎 {att.fileName}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-black/10 border-t border-white/5 text-xs text-slate-500">
                Creada {new Date(account.createdAt).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </RbacShell>
  );
}
