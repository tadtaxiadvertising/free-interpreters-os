import { DashboardShell } from "@/components/DashboardShell";
import { auth } from '@/lib/auth';
import { getCurrentProfile } from '@/app/actions/auth';
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {

  const { userId } = await auth();
  if (!userId) redirect('/login');

  const profile = await getCurrentProfile();

  if (profile && profile.role === 'admin') {
    redirect('/admin');
  }

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

  // ── Compute ranking data for the sidebar ──
  let ranking = null;
  if (profile?.interpreter_id) {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);

      // Get all interpreters' monthly minutes and latest QA for ranking
      const allInterpreters = await db.interpreter.findMany({
        select: {
          id: true,
          callSessions: {
            where: {
              startedAt: { gte: startOfMonth, lte: endOfMonth },
              endedAt: { not: null },
            },
            select: { durationSeconds: true },
          },
          productionLogs: {
            where: {
              date: { gte: startOfMonth, lte: endOfMonth },
            },
            select: { interpretedMinutes: true },
          },
          qaScores: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { totalScore: true }
          }
        },
      });

      // Calculate total minutes and get latest QA for each interpreter
      const rankings = allInterpreters.map((interp: any) => {
        const sessionMin = Math.round(
          (interp.callSessions || []).reduce((s: number, c: any) => s + (c.durationSeconds || 0), 0) / 60
        );
        const logMin = (interp.productionLogs || []).reduce(
          (s: number, l: any) => s + (l.interpretedMinutes || 0), 0
        );
        const latestQa = interp.qaScores?.[0]?.totalScore ? Number(interp.qaScores[0].totalScore) : 0;

        return {
          id: interp.id,
          totalMinutes: sessionMin + logMin,
          qaScore: latestQa
        };
      });

      // Sort descending (Minutes desc, then QA Score desc as tiebreaker)
      rankings.sort((a: any, b: any) => {
        if (b.totalMinutes !== a.totalMinutes) {
          return b.totalMinutes - a.totalMinutes;
        }
        return b.qaScore - a.qaScore;
      });

      const myEntry = rankings.find((r: any) => r.id === profile.interpreter_id);
      const myPosition = rankings.findIndex((r: any) => r.id === profile.interpreter_id) + 1;
      const totalMinutesAll = rankings.reduce((s: number, r: any) => s + r.totalMinutes, 0);
      const avgMinutes = rankings.length > 0 ? Math.round(totalMinutesAll / rankings.length) : 0;

      ranking = {
        position: myPosition || rankings.length,
        totalInterpreters: rankings.length,
        myMinutes: myEntry?.totalMinutes || 0,
        avgMinutes,
      };
    } catch (error) {
      console.error('❌ LAYOUT: Ranking calculation failed:', error);
    }
  }

  return (
    <DashboardShell
      role="interpreter"
      userName={profile?.display_name || "Interpreter"}
      notifications={notifications}
      ranking={ranking}
    >
      {children}
    </DashboardShell>
  );
}
