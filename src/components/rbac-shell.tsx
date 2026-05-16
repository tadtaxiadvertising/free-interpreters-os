"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const ROLE_NAV: Record<string, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/portal-rbac/admin/dashboard", icon: <BarChart /> },
    { label: "Usuarios", href: "/portal-rbac/admin/users", icon: <Users /> },
    { label: "Moderación", href: "/portal-rbac/admin/messages", icon: <MessageSquare /> },
  ],
  HOLDER: [
    { label: "Mis Cuentas", href: "/portal-rbac/holder/dashboard", icon: <Briefcase /> },
    { label: "Mensajes", href: "/portal-rbac/holder/messages", icon: <MessageSquare /> },
  ],
  INTERPRETER: [
    { label: "Cuentas Asignadas", href: "/portal-rbac/interpreter/dashboard", icon: <Key /> },
    { label: "Mensajes", href: "/portal-rbac/interpreter/messages", icon: <MessageSquare /> },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "from-red-500 to-rose-600",
  HOLDER: "from-amber-500 to-orange-600",
  INTERPRETER: "from-blue-500 to-indigo-600",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  HOLDER: "Titular",
  INTERPRETER: "Intérprete",
};

interface Props {
  requiredRole: string;
  children: React.ReactNode;
}

export default function RbacShell({ requiredRole, children }: Props) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/portal-rbac/login");
      return;
    }
    if (role !== requiredRole) {
      router.replace("/portal-rbac/login");
    }
  }, [session, status, role, requiredRole, router]);

  if (status === "loading") {
    return <LoadingSkeleton />;
  }

  if (!session || role !== requiredRole) {
    return <LoadingSkeleton />;
  }

  const navItems = ROLE_NAV[role] || [];
  const gradient = ROLE_COLORS[role] || "from-slate-500 to-slate-600";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-black/20 backdrop-blur-xl flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Free Interpreters</h2>
              <span className={`text-[10px] font-semibold uppercase tracking-widest bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all group"
            >
              <span className="text-slate-500 group-hover:text-white transition-colors">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Info + Logout */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold`}>
              {session.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{session.user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{session.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/portal-rbac/login" })}
            className="w-full mt-2 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-72 border-r border-white/5 bg-black/20 p-6 space-y-4">
        <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
        <div className="space-y-2 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-8 space-y-4">
        <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-white/5 rounded-2xl animate-pulse" />
      </main>
    </div>
  );
}

// ── Inline Icons ───────────────────────────────────────────────
function BarChart() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></svg>;
}
function Users() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function MessageSquare() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function Briefcase() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
}
function Key() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>;
}
