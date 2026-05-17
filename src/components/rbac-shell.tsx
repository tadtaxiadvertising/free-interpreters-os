"use client";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const handleToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

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

  if (status === "loading" || !session || role !== requiredRole) {
    return (
      <div className="flex min-h-screen w-full bg-[#0a0f1c]">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const subtitle = ROLE_LABELS[role] || "Portal";

  return (
    <div className="flex min-h-screen w-full bg-[#0a0f1c] overflow-hidden">
      <Sidebar 
        role={role.toLowerCase()} 
        isCollapsed={isCollapsed} 
        onToggle={handleToggle} 
        appName="Portal RBAC"
        appSubtitle={subtitle}
      />
      
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        <Navbar 
          email={session.user?.email || "Usuario"} 
          onSignOut={() => signOut({ callbackUrl: "/portal-rbac/login" })}
        />
        
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar transition-all duration-500 relative">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
