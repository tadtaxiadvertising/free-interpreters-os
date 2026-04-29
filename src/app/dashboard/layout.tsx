import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const notifications = user ? await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  }) : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar role="interpreter" notifications={notifications} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

