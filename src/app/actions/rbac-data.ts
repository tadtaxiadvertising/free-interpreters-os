"use server";
/**
 * RBAC DATA ACTIONS
 * ============================================================
 * Unified data-fetching layer for portal-rbac pages.
 * Uses requireRole() for Auth.js session validation, then
 * queries the same Prisma models as the main dashboard.
 *
 * Bridge: RbacUser.email → Interpreter.emailCorporativo
 * ============================================================
 */
import { requireRole, type RbacSession } from "@/lib/auth-rbac";
import prisma from "@/lib/prisma";

const db = prisma as any;

// ── Helper: Resolve RbacUser → Interpreter ─────────────────────
async function resolveInterpreter(session: RbacSession) {
  const interpreter = await db.interpreter.findFirst({
    where: { emailCorporativo: session.user.email },
  });
  return interpreter;
}

// ── Interpreter: Dashboard Data ────────────────────────────────
export async function getRbacInterpreterDashboard() {
  const session = await requireRole("INTERPRETER");
  const interpreter = await resolveInterpreter(session);
  if (!interpreter) return { interpreter: null };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [activeCall, todayCalls, monthCalls, monthLogs, recentCalls] = await Promise.all([
    db.callSession.findFirst({
      where: { interpreterId: interpreter.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    }),
    db.callSession.findMany({
      where: {
        interpreterId: interpreter.id,
        startedAt: { gte: todayStart },
        endedAt: { not: null },
      },
      select: { durationSeconds: true, callCost: true },
    }),
    db.callSession.findMany({
      where: {
        interpreterId: interpreter.id,
        startedAt: { gte: startOfMonth, lte: endOfMonth },
        endedAt: { not: null },
      },
      select: { durationSeconds: true, callCost: true },
    }),
    db.productionLog.findMany({
      where: {
        interpreterId: interpreter.id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { interpretedMinutes: true },
    }),
    db.callSession.findMany({
      where: { interpreterId: interpreter.id, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const todayMinutes =
    todayCalls.reduce(
      (s: number, c: any) => s + (c.durationSeconds || 0),
      0
    ) / 60;
  const sessionMinMtd =
    monthCalls.reduce(
      (s: number, c: any) => s + (c.durationSeconds || 0),
      0
    ) / 60;
  const logMinMtd = monthLogs.reduce(
    (s: number, l: any) => s + (l.interpretedMinutes || 0),
    0
  );
  const mtdMinutes = sessionMinMtd + logMinMtd;
  const monthlyGoal = interpreter.monthlyGoal || 7200; // default 120h * 60
  const dailyGoal = monthlyGoal / 22;
  const mtdEarnings = monthCalls.reduce(
    (s: number, c: any) => s + Number(c.callCost || 0),
    0
  );

  // QA
  const qaScores = await db.qAScore.findMany({
    where: { interpreterId: interpreter.id },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { totalScore: true },
  });
  const latestQa = qaScores[0]?.totalScore
    ? Number(qaScores[0].totalScore)
    : 0;

  return {
    interpreter: {
      id: interpreter.id,
      name: interpreter.name,
      campaign: interpreter.campaign,
      languageA: interpreter.languageA,
      languageB: interpreter.languageB,
      tariffPerMinute: Number(interpreter.tariffPerMinute || 0),
      realtimeStatus: interpreter.realtimeStatus,
      monthlyGoal,
    },
    activeCall: activeCall
      ? {
          sessionId: activeCall.id,
          startedAt: activeCall.startedAt.toISOString(),
          tariffSnapshot: Number(activeCall.tariffSnapshot),
        }
      : null,
    todayMinutes: Math.round(todayMinutes),
    mtdMinutes: Math.round(mtdMinutes),
    dailyGoal: Math.round(dailyGoal),
    monthlyGoal,
    mtdEarnings,
    latestQa,
    recentCalls: recentCalls.map((c: any) => ({
      id: c.id,
      started_at: c.startedAt.toISOString(),
      ended_at: c.endedAt?.toISOString() || null,
      duration_seconds: c.durationSeconds,
      call_cost: Number(c.callCost),
      tariff_snapshot: Number(c.tariffSnapshot)
    })),
  };
}

// ── Interpreter: Calendar Commitment ───────────────────────────
export async function getRbacCalendarData() {
  const session = await requireRole("INTERPRETER");
  const interpreter = await resolveInterpreter(session);
  if (!interpreter) return null;

  const { getInterpreterCommitment } = await import("./calendar");
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  }).format(new Date());
  return getInterpreterCommitment(interpreter.id, todayStr);
}

// ── Interpreter: Ranking Data ──────────────────────────────────
export async function getRbacRankingData() {
  const session = await requireRole("INTERPRETER");
  const interpreter = await resolveInterpreter(session);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let globalGoalMinutes = 7200;
  try {
    const { getSystemConfig } = await import("./settings");
    const h = parseFloat(await getSystemConfig("standard_monthly_goal_hours", "120"));
    globalGoalMinutes = h * 60;
  } catch {}

  const activeInterpreters = await db.interpreter.findMany({
    where: { status: "Activo" },
    select: { id: true, name: true, campaign: true, monthlyGoal: true },
  });
  
  const interpreterIds = activeInterpreters.map((i: any) => i.id);

  const [sessionAgg, logsAgg, latestQas] = await Promise.all([
    db.callSession.groupBy({
      by: ['interpreterId'],
      where: {
        interpreterId: { in: interpreterIds },
        startedAt: { gte: startOfMonth, lte: endOfMonth },
        endedAt: { not: null },
      },
      _sum: { durationSeconds: true },
    }),
    db.productionLog.groupBy({
      by: ['interpreterId'],
      where: {
        interpreterId: { in: interpreterIds },
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { interpretedMinutes: true },
    }),
    db.qAScore.findMany({
      where: { interpreterId: { in: interpreterIds } },
      orderBy: { createdAt: "desc" },
      distinct: ['interpreterId'],
      select: { interpreterId: true, totalScore: true },
    })
  ]);

  const sessionMap = new Map<number, number>(sessionAgg.map((s: any) => [s.interpreterId, Number(s._sum.durationSeconds) || 0]));
  const logsMap = new Map<number, number>(logsAgg.map((l: any) => [l.interpreterId, Number(l._sum.interpretedMinutes) || 0]));
  const qaMap = new Map<number, number>(latestQas.map((q: any) => [q.interpreterId, Number(q.totalScore) || 0]));

  const rankings = activeInterpreters
    .map((interp: any) => {
      const sessionMin = Math.round((sessionMap.get(interp.id) || 0) / 60);
      const logMin = logsMap.get(interp.id) || 0;
      const totalMinutes = sessionMin + logMin;
      const qaScore = qaMap.get(interp.id) || 0;
      const goal = interp.monthlyGoal ?? globalGoalMinutes;
      const goalProgress = Math.min((totalMinutes / goal) * 100, 100);

      return {
        id: interp.id,
        name: interp.name,
        campaign: interp.campaign,
        totalMinutes,
        qaScore,
        monthlyGoal: goal,
        goalProgress,
      };
    })
    .sort((a: any, b: any) => {
      if (b.totalMinutes !== a.totalMinutes)
        return b.totalMinutes - a.totalMinutes;
      return b.qaScore - a.qaScore;
    });

  const totalAll = rankings.reduce(
    (s: number, r: any) => s + r.totalMinutes,
    0
  );
  const avg = rankings.length > 0 ? Math.round(totalAll / rankings.length) : 0;
  const myIdx = interpreter
    ? rankings.findIndex((r: any) => r.id === interpreter.id)
    : -1;

  return { rankings, avg, myIdx, myInterpreterId: interpreter?.id || null };
}

// ── Interpreter: Earnings ──────────────────────────────────────
export async function getRbacEarningsData() {
  const session = await requireRole("INTERPRETER");
  const interpreter = await resolveInterpreter(session);
  if (!interpreter) return null;

  const full = await db.interpreter.findUnique({
    where: { id: interpreter.id },
    select: {
      id: true,
      name: true,
      tariffPerMinute: true,
      metodoPago: true,
      cuentaPago: true,
      payrollRecords: {
        orderBy: { periodStart: "desc" },
        take: 12,
      },
    },
  });

  return full;
}

// ── Admin: Full Dashboard Stats ────────────────────────────────
export async function getRbacAdminDashboard() {
  await requireRole("ADMIN");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [interpreters, activeCalls, todaySessionsAgg, monthSessionsAgg, monthLogsAgg, pendingMessages] =
    await Promise.all([
      db.interpreter.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          externalId: true,
          name: true,
          realtimeStatus: true,
          campaign: true,
          tariffPerMinute: true,
          updatedAt: true,
          monthlyGoal: true,
        },
      }),
      db.callSession.findMany({
        where: { endedAt: null },
        select: { id: true, interpreterId: true },
      }),
      db.callSession.aggregate({
        where: { startedAt: { gte: todayStart } },
        _sum: { durationSeconds: true, callCost: true },
      }),
      db.callSession.groupBy({
        by: ['interpreterId'],
        where: { startedAt: { gte: monthStart }, endedAt: { not: null } },
        _sum: { durationSeconds: true, callCost: true },
      }),
      db.productionLog.groupBy({
        by: ['interpreterId'],
        where: { date: { gte: monthStart } },
        _sum: { interpretedMinutes: true },
      }),
      db.vaultMessage.count({ where: { status: "PENDING_ADMIN" } }),
    ]);

  const monthSessionsMap = new Map<number, any>(monthSessionsAgg.map((s: any) => [s.interpreterId, s]));
  const monthLogsMap = new Map<number, number>(monthLogsAgg.map((l: any) => [l.interpreterId, Number(l._sum.interpretedMinutes) || 0]));

  let totalCostMonth = 0;

  // Calculate per-interpreter stats
  const interpreterStats = interpreters
    .map((interp: any) => {
      const sAgg = monthSessionsMap.get(interp.id) as any;
      const sessionSeconds = sAgg?._sum?.durationSeconds || 0;
      const sessionMin = Math.round(sessionSeconds / 60);
      const callCost = Number(sAgg?._sum?.callCost || 0);
      totalCostMonth += callCost;

      const logMin = monthLogsMap.get(interp.id) || 0;

      return {
        ...interp,
        tariffPerMinute: Number(interp.tariffPerMinute),
        totalMinutes: sessionMin + logMin,
        totalHours: (sessionMin + logMin) / 60,
      };
    })
    .sort((a: any, b: any) => b.totalMinutes - a.totalMinutes);

  const totalMinutesToday = Math.round(Number(todaySessionsAgg._sum.durationSeconds || 0) / 60);
  const totalCostToday = Number(todaySessionsAgg._sum.callCost || 0);

  const totalMinutesMonth = interpreterStats.reduce(
    (sum: number, i: any) => sum + i.totalMinutes,
    0
  );

  const STALE_THRESHOLD = 2 * 60 * 1000;
  const nowTime = Date.now();
  const onlineCount = interpreters.filter(
    (i: any) =>
      i.realtimeStatus === "Online" &&
      nowTime - new Date(i.updatedAt).getTime() < STALE_THRESHOLD
  ).length;
  const busyCount = interpreters.filter(
    (i: any) => i.realtimeStatus === "Busy"
  ).length;

  return {
    interpreterStats,
    topPerformers: interpreterStats.slice(0, 5),
    activeCalls: activeCalls.length,
    totalMinutesToday,
    totalCostToday,
    totalMinutesMonth,
    totalCostMonth,
    onlineCount,
    busyCount,
    totalInterpreters: interpreters.length,
    pendingMessages,
  };
}
