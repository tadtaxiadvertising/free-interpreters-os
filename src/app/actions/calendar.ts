"use server";

import prisma from "@/lib/prisma";

export async function getInterpreterCommitment(interpreterId: number, targetDateStr: string) {
  const targetDate = new Date(targetDateStr);
  const interpreter = await prisma.interpreter.findUnique({
    where: { id: interpreterId },
  });

  if (!interpreter) throw new Error("Interpreter not found");

  const startOfWeek = new Date(targetDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

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

  const sessions = await prisma.callSession.findMany({
    where: {
      interpreterId,
      startedAt: {
        gte: startOfWeek,
        lte: endOfWeek,
      }
    }
  });

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

  sessions.forEach(session => {
    if (!session.startedAt) return;
    const dayStr = getLocalDateStr(session.startedAt);
    const existing = dailyStats.get(dayStr) || 0;
    const minutes = session.durationSeconds ? Math.floor(session.durationSeconds / 60) : 0;
    dailyStats.set(dayStr, existing + minutes);
  });

  let totalMinutesWeek = 0;
  let targetMinutesToDate = 0;
  const today = new Date();
  const todayStr = getLocalDateStr(today);
  
  for (let i = 0; i < 5; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
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
  const interpreters = await prisma.interpreter.findMany({
    where: { status: "Activo" }
  });

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const logs = await prisma.productionLog.findMany({
    where: {
      date: {
        gte: startOfMonth,
        lte: endOfMonth
      }
    }
  });

  const sessions = await prisma.callSession.findMany({
    where: {
      startedAt: {
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
    const intSessions = sessions.filter(s => s.interpreterId === int.id);

    const daysInMonth = endOfMonth.getDate();
    const days = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayStr = getLocalDateStr(d);

      let logsMinutes = 0;
      let sessionsMinutes = 0;

      intLogs.filter(l => getLocalDateStr(l.date) === dayStr).forEach(l => {
        logsMinutes += l.interpretedMinutes || 0;
      });

      intSessions.filter(s => s.startedAt && getLocalDateStr(s.startedAt) === dayStr).forEach(s => {
        sessionsMinutes += s.durationSeconds ? Math.floor(s.durationSeconds / 60) : 0;
      });

      const minutes = logsMinutes + sessionsMinutes;

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
