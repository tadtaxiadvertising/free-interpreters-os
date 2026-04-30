import { Sidebar } from "@/components/Sidebar";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  // Resolve the internal profile ID to match notifications stored under either ID format
  const db = prisma as any;
  const profile = await db.userProfile.findFirst({
    where: { clerkId: userId },
    select: { id: true }
  });

  const notificationUserIds = [userId];
  if (profile?.id && profile.id !== userId) {
    notificationUserIds.push(profile.id);
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: { in: notificationUserIds } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role="interpreter" notifications={notifications} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

