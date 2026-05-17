import React from "react";
import ResetPasswordClientForm from "@/app/portal-rbac/reset-password/[token]/ResetPasswordClientForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

// Next.js 16 requiere obligatoriamente resolver el Layout/Page params de forma asíncrona
export default async function ResetPasswordPage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
            Establecer Nueva Contraseña
          </h1>
          <p className="text-sm text-slate-400">
            Su token ha sido validado. Ingrese una contraseña segura que cumpla con los estándares mínimos requeridos.
          </p>
        </div>

        {/* Transferimos el token limpio y extraído asíncronamente al componente de interactividad en cliente */}
        <ResetPasswordClientForm token={token} />
      </div>
    </div>
  );
}
