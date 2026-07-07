"use server";

import prisma from "@/lib/prisma";

/**
 * Format a Date from a @db.Date column to "YYYY-MM-DD".
 *
 * Prisma reads @db.Date as midnight UTC. Converting that via a timezone
 * (e.g. America/Santo_Domingo UTC-4) shifts it to the *previous* day.
 * Since @db.Date stores a pure date, we extract the date directly from
 * midnight UTC — it matches the stored calendar date.
 */
function formatDbDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Format an arbitrary Date (e.g. a generated UTC day-loop date) into a
 * Santo_Domingo date string, so that "midnight UTC" corresponds to
 * "8 PM previous day" in the local calendar.
 */
function formatSantoDomingoDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export async function getInterpreterCommitment(interpreterId: number, targetDateStr: string) {
  // Usar 12:00 UTC para evitar que al formatear a Santo Domingo (UTC-4) cambie de día
  const targetDate = new Date(`${targetDateStr}T12:00:00Z`);
  const interpreter = await prisma.interpreter.findUnique({
    where: { id: interpreterId },
  });

  if (!interpreter) throw new Error("Interpreter not found");

  const startOfWeek = new Date(targetDate);
  const day = startOfWeek.getUTCDay();
  const diff = startOfWeek.getUTCDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setUTCDate(diff);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  const logs = await prisma.productionLog.findMany({
    where: {
      interpreterId,
      date: {
        gte: startOfWeek,
        lte: endOfWeek,
      }
    }
  });

  const dailyGoalMinutes = Math.floor((interpreter.monthlyGoal || 2000) / 22);

  const dailyStats = new Map<string, number>();

  logs.forEach(log => {
    const dayStr = formatDbDate(log.date);
    const existing = dailyStats.get(dayStr) || 0;
    dailyStats.set(dayStr, existing + (log.interpretedMinutes || 0));
  });

  let totalMinutesWeek = 0;
  let targetMinutesToDate = 0;
  const today = new Date();
  const todayStr = formatSantoDomingoDate(today);

  for (let i = 0; i < 5; i++) {
    const d = new Date(startOfWeek);
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(12, 0, 0, 0); // Mediodía UTC para que al aplicar UTC-4 siga siendo el mismo día
    const dayStr = formatSantoDomingoDate(d);
    const achieved = dailyStats.get(dayStr) || 0;
    totalMinutesWeek += achieved;

    if (dayStr <= todayStr) {
      targetMinutesToDate += dailyGoalMinutes;
    }
  }

  const deficit = targetMinutesToDate - totalMinutesWeek;

  let recoverySuggestions = null;
  if (deficit > 0) {
    recoverySuggestions = {
      saturdayMinutes: Math.ceil(deficit / 2),
      sundayMinutes: Math.floor(deficit / 2),
      totalNeeded: deficit
    };
  }

  const healthScore = targetMinutesToDate === 0 ? 100 : Math.min(100, Math.round((totalMinutesWeek / targetMinutesToDate) * 100));

  return {
    interpreter,
    healthScore,
    dailyGoalMinutes,
    totalMinutesWeek,
    targetMinutesToDate,
    deficit: Math.max(0, deficit),
    surplus: Math.max(0, -deficit),
    recoverySuggestions,
    dailyStats: Array.from(dailyStats.entries()).map(([date, minutes]) => ({ date, minutes }))
  };
}

export async function getComplianceBoard(year: number, month: number) {
  const interpreters = await prisma.interpreter.findMany();

  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const [logs, callSessions] = await Promise.all([
    prisma.productionLog.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    }),
    prisma.callSession.findMany({
      where: {
        startedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        endedAt: { not: null },
      },
      select: {
        interpreterId: true,
        startedAt: true,
        durationSeconds: true,
      }
    }),
  ]);

  // Build session minutes per interpreter per day
  const sessionMinutesByIntDay = new Map<string, number>();
  callSessions.forEach(s => {
    if (!s.interpreterId) return;
    const dayStr = formatSantoDomingoDate(s.startedAt);
    const key = `${s.interpreterId}:${dayStr}`;
    const existing = sessionMinutesByIntDay.get(key) || 0;
    sessionMinutesByIntDay.set(key, existing + Math.floor((s.durationSeconds || 0) / 60));
  });

  const board = interpreters.map(int => {
    const dailyGoalMinutes = Math.floor((int.monthlyGoal || 2000) / 22);
    const intLogs = logs.filter(l => l.interpreterId === int.id);

    const daysInMonth = endOfMonth.getUTCDate();
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Mediodía UTC para evitar salto de día en UTC-4
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
      const dayStr = formatSantoDomingoDate(d);

      let logsMinutes = 0;

      intLogs.filter(l => formatDbDate(l.date) === dayStr).forEach(l => {
        logsMinutes += l.interpretedMinutes || 0;
      });

      const minutes = logsMinutes;
      const sessionsMinutes = sessionMinutesByIntDay.get(`${int.id}:${dayStr}`) || 0;

      let status = "Not Needed";
      if (!isWeekend) {
        if (minutes === 0) status = "No-Show";
        else if (minutes < dailyGoalMinutes) status = "Late";
        else if (minutes >= dailyGoalMinutes * 1.1) status = "Overproduction";
        else status = "Fulfilled";
      } else {
        if (minutes > 0) status = "Overproduction";
      }

      days.push({
        date: dayStr,
        isWeekend,
        minutes,
        logsMinutes,
        sessionsMinutes,
        status,
        dailyGoalMinutes
      });
    }

    const mtdMinutes = days.reduce((acc, d) => acc + d.minutes, 0);
    const monthlyGoal = int.monthlyGoal || 2000;
    const fulfillmentPercent = monthlyGoal > 0 ? (mtdMinutes / monthlyGoal) * 100 : 0;

    return {
      interpreter: int,
      monthlyGoal,
      mtdMinutes,
      fulfillmentPercent,
      days
    };
  });

  return board;
}
