import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { auth } from '@/lib/auth';
import { getCurrentProfile } from '@/app/actions/auth';
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const profile = await getCurrentProfile();

  const notificationUserIds = [userId];
  if (profile?.id && profile.id !== userId) {
    notificationUserIds.push(profile.id);
  }

  const db = prisma as any;
  const notifications = await db.notification.findMany({
    where: { userId: { in: notificationUserIds } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[256px_1fr]">
      <Sidebar role="interpreter" notifications={notifications} />
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar email={profile?.display_name || "Interpreter"} />
        <main className="flex-1 p-8 overflow-y-auto bg-[#0a0f1c]">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

