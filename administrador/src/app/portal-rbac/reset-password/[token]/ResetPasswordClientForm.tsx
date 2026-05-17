"use client";

import React, { useState, useTransition } from "react";
import { executeResetAction } from "@/app/actions/auth-portal";

export default function ResetPasswordClientForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData(event.currentTarget);
    formData.append("token", token);

    startTransition(async () => {
      const result = await executeResetAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess("Contraseña restablecida de forma exitosa. Redirigiendo al login...");
        setTimeout(() => {
          window.location.href = "/portal-rbac/login";
        }, 3000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Nueva Contraseña
        </label>
        <input
          type="password"
          name="password"
          required
          disabled={isPending}
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Confirmar Contraseña
        </label>
        <input
          type="password"
          name="confirmPassword"
          required
          disabled={isPending}
          className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
          placeholder="Repita la contraseña"
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
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex justify-center items-center"
      >
        {isPending ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          "Guardar Cambios Seguros"
        )}
      </button>
    </form>
  );
}
