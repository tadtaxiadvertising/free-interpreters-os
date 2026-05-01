import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { getCurrentProfile } from "@/app/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[256px_1fr]">
      <Sidebar role="admin" />
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar email={profile?.display_name || "Admin"} />
        <main className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
