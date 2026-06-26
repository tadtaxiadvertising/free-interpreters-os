"use server";

import prisma from "@/lib/prisma";

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

  const getLocalDateStr = (d: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santo_Domingo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };

  logs.forEach(log => {
    const dayStr = getLocalDateStr(log.date);
    const existing = dailyStats.get(dayStr) || 0;
    dailyStats.set(dayStr, existing + (log.interpretedMinutes || 0));
  });

  let totalMinutesWeek = 0;
  let targetMinutesToDate = 0;
  const today = new Date();
  const todayStr = getLocalDateStr(today);

  for (let i = 0; i < 5; i++) {
    const d = new Date(startOfWeek);
    d.setUTCDate(d.getUTCDate() + i);
    d.setUTCHours(12, 0, 0, 0); // Mediodía UTC para que al aplicar UTC-4 siga siendo el mismo día
    const dayStr = getLocalDateStr(d);
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

  const logs = await prisma.productionLog.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });

  const getLocalDateStr = (d: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santo_Domingo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  };

  const board = interpreters.map(int => {
    const dailyGoalMinutes = Math.floor((int.monthlyGoal || 2000) / 22);
    const intLogs = logs.filter(l => l.interpreterId === int.id);

    const daysInMonth = endOfMonth.getUTCDate();
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0)); // Mediodía UTC para evitar salto de día en UTC-4
      const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
      const dayStr = getLocalDateStr(d);

      let logsMinutes = 0;

      intLogs.filter(l => getLocalDateStr(l.date) === dayStr).forEach(l => {
        logsMinutes += l.interpretedMinutes || 0;
      });

      const minutes = logsMinutes;

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
        sessionsMinutes: 0,
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
