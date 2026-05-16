"use client";
import { useTransition, use } from "react";
import { resetPassword } from "@/app/actions/rbac-auth";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const handleSubmit = (formData: FormData) => {
    if (!token) {
      toast.error("Token no válido");
      return;
    }

    startTransition(async () => {
      // Add token to form data
      formData.append("token", token);
      
      const result = await resetPassword(formData);
      if (result.success) {
        toast.success("Contraseña actualizada correctamente.");
        setTimeout(() => {
          router.push("/portal-rbac/login");
        }, 2000);
      } else {
        toast.error(result.error || "Ocurrió un error");
      }
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Token Inválido</h1>
          <p className="text-slate-400">Este enlace de recuperación no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Nueva Contraseña</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Ingresa tu nueva contraseña para recuperar el acceso.
          </p>
        </div>

        <form
          action={handleSubmit}
          className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 shadow-2xl"
        >
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">
              Nueva Contraseña
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>

          <button
            disabled={isPending}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 text-white py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50"
          >
            {isPending ? "Actualizando..." : "Restablecer Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
