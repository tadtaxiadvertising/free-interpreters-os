import React from "react";
import { getInterpreterAccounts } from "@/app/actions/rbac-interpreter";
import { Key, Globe, Shield, Copy, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InterpreterAccountsPage() {
  let accounts: any[] = [];
  try {
    accounts = await getInterpreterAccounts();
  } catch {
    // User might not have any accounts assigned
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-indigo-500/20 rounded-xl">
          <Key size={24} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cuentas Asignadas</h1>
          <p className="text-sm text-slate-400">
            Credenciales de plataformas asignadas por el administrador
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="glass rounded-3xl p-16 border border-white/5 text-center">
          <Key size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            Sin cuentas asignadas
          </h3>
          <p className="text-slate-400">
            El administrador no ha asignado cuentas de plataforma a tu perfil.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {accounts.map((account: any) => (
            <div
              key={account.id}
              className="glass rounded-2xl p-6 border border-white/5 hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10">
                    <Globe size={18} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">
                      {account.platformName}
                    </h3>
                    {account.holder && (
                      <p className="text-xs text-slate-500">
                        Titular: {account.holder.name}
                      </p>
                    )}
                  </div>
                </div>
                {account.url && (
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>

              <div className="space-y-3">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      Credenciales
                    </span>
                    <Shield size={14} className="text-emerald-500" />
                  </div>
                  <p className="text-white font-mono text-sm break-all">
                    {account.decryptedCredentials}
                  </p>
                </div>

                {account.vpnConfig && (
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      VPN Config
                    </span>
                    <p className="text-white font-mono text-sm mt-1">
                      {account.vpnConfig}
                    </p>
                  </div>
                )}

                {account.notes && (
                  <p className="text-xs text-slate-400 italic">
                    {account.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
