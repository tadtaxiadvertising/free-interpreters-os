import { DashboardShell } from "@/components/DashboardShell";
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
    <DashboardShell 
      role="interpreter" 
      userName={profile?.display_name || "Interpreter"}
      notifications={notifications}
    >
      {children}
    </DashboardShell>
  );
}

