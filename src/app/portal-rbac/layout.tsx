import { auth } from "@/lib/auth-rbac";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  
  // Protect all /portal-rbac routes EXCEPT login
  // Since we are in the layout, we can do simple role-based routing checks here or let pages handle it
  // This avoids tampering with the root middleware.ts which is currently configured for Supabase.

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        {children}
      </div>
    </SessionProvider>
  );
}
