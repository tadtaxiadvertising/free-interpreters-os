import { auth } from "@/lib/auth-rbac";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: "/portal-rbac/admin",
  HOLDER: "/portal-rbac/holder",
  INTERPRETER: "/portal-rbac/interpreter",
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "rgba(15, 23, 42, 0.95)",
              color: "#f1f5f9",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            },
            success: { iconTheme: { primary: "#34d399", secondary: "#0f172a" } },
            error: { iconTheme: { primary: "#f87171", secondary: "#0f172a" } },
          }}
        />
        {children}
      </div>
    </SessionProvider>
  );
}
