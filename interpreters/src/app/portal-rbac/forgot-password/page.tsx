"use client";

import React, { useState, useTransition } from "react";
import { requestResetAction } from "@/app/actions/auth-portal";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await requestResetAction(formData);
      // Por seguridad de enumeración de usuarios, siempre mostramos el mismo mensaje genérico en UI
      setMessage(result.message);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <a
            href="/portal-rbac/login"
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            ← Volver al login
          </a>
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Recuperar Contraseña
          </h1>
          <p className="text-sm text-slate-400">
            Ingrese su correo corporativo registrado para iniciar el proceso de recuperación de credenciales.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Correo Institucional
            </label>
            <input
              type="email"
              name="email"
              required
              disabled={isPending}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
              placeholder="operaciones@freeinterpreters.com"
            />
          </div>

          {message && (
            <div className="p-3 bg-blue-950/40 border border-blue-900/60 text-blue-300 rounded-xl text-sm leading-relaxed">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-white font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50 flex justify-center items-center"
          >
            {isPending ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Solicitar Enlace de Recuperación"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
