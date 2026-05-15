import { DashboardShell } from "@/components/DashboardShell";
import { getCurrentProfile } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <DashboardShell role="admin" userName={profile?.display_name || "Admin"}>
      {children}
    </DashboardShell>
  );
}
