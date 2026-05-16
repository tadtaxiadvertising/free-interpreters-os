"use client";
import { useTransition } from "react";
import { forgotPassword } from "@/app/actions/rbac-auth";
import toast from "react-hot-toast";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await forgotPassword(formData);
      if (result.success) {
        toast.success("Si el correo existe, recibirás instrucciones.");
      } else {
        toast.error(result.error || "Ocurrió un error");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Recuperar Acceso</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Ingresa tu correo para recibir un enlace de restablecimiento.
          </p>
        </div>

        <form
          action={handleSubmit}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Correo Electrónico
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="tu@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <button
            disabled={isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
          >
            {isPending ? "Procesando..." : "Enviar Enlace"}
          </button>

          <div className="mt-6 text-center">
            <Link 
              href="/portal-rbac/login" 
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
