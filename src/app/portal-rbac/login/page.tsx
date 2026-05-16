"use client";

import React, { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth-portal";

export default function PortalLoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess("Autenticación exitosa. Redireccionando...");
        window.location.href = "/portal-rbac/dashboard";
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl transition-all">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            Portal RBAC Vault
          </h1>
          <p className="text-sm text-slate-400">
            Ingreso exclusivo para Personal Autorizado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              name="email"
              required
              disabled={isPending}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
              placeholder="nombre@empresa.com"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contraseña
              </label>
              <a
                href="/portal-rbac/forgot-password"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                ¿Olvidó su contraseña?
              </a>
            </div>
            <input
              type="password"
              name="password"
              required
              disabled={isPending}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-900 text-red-400 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-900 text-emerald-400 rounded-xl text-sm font-medium">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {isPending ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
