import prismaClient from "@/lib/prisma";

/**
 * Calculates historical performance matching production_logs and call_sessions.
 * Regla de Oro 1: Prisma singleton (no $disconnect).
 */
export async function getPerformanceHistory(interpreterId: number, year: number, month: number) {
  const prisma = prismaClient;
  
  // Usamos fechas UTC para evitar solapamiento horario en la base de datos
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const interpreter = await prisma.interpreter.findUnique({
    where: { id: interpreterId },
    select: { monthlyGoal: true, name: true, externalId: true }
  });

  if (!interpreter) {
    throw new Error("Intérprete no encontrado");
  }

  // 1. Meta Mensual (dinámica desde el perfil, default 2000)
  const monthlyGoal = interpreter.monthlyGoal || 2000;
  
  // 2. Meta Diaria Calculada (Mensual / 22 días laborables)
  const dailyGoal = Math.floor(monthlyGoal / 22);

  // Consultas optimizadas concurrentes (evitando N+1 queries)
  const [logs, sessions] = await Promise.all([
    prisma.productionLog.findMany({
      where: { 
        interpreterId, 
        date: { gte: startOfMonth, lte: endOfMonth } 
      }
    }),
    prisma.callSession.findMany({
      where: { 
        interpreterId, 
        startedAt: { gte: startOfMonth, lte: endOfMonth }, 
        endedAt: { not: null } 
      }
    })
  ]);

  // Construcción del historial por día
  const daysInMonth = endOfMonth.getUTCDate();
  const dailyHistory = [];
  let totalInterpreted = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    const isWeekend = dateObj.getUTCDay() === 0 || dateObj.getUTCDay() === 6;
    const dateStr = dateObj.toISOString().split('T')[0];

    // Filtrar registros estáticos (CSV / Manual Logs)
    const dayLogs = logs.filter(l => l.date.toISOString().split('T')[0] === dateStr);
    
    // Filtrar sesiones en tiempo real (Telemetría de Command Center)
    const daySessions = sessions.filter(s => s.startedAt && s.startedAt.toISOString().split('T')[0] === dateStr);

    const logMinutes = dayLogs.reduce((acc, l) => acc + (l.interpretedMinutes || 0), 0);
    const sessionMinutes = daySessions.reduce((acc, s) => acc + Math.floor((s.durationSeconds || 0) / 60), 0);
    
    // 3. Cálculo de Progreso Unificado
    const totalMinutes = logMinutes + sessionMinutes;
    totalInterpreted += totalMinutes;

    // Clasificación de colores basada en Tailwind v4 (Green, Yellow, Red)
    let statusColor = "bg-slate-50 text-slate-500 border border-slate-200"; 
    let progressPercent = 0;

    if (!isWeekend || totalMinutes > 0) {
      progressPercent = dailyGoal > 0 ? (totalMinutes / dailyGoal) * 100 : 0;
      
      if (progressPercent >= 100) {
        statusColor = "bg-green-500/10 text-green-600 border border-green-500/20";
      } else if (progressPercent >= 50) {
        statusColor = "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20";
      } else {
        statusColor = "bg-red-500/10 text-red-600 border border-red-500/20";
      }
    }

    dailyHistory.push({
      date: dateStr,
      isWeekend,
      logMinutes,
      sessionMinutes,
      totalMinutes,
      progressPercent: Math.min(100, Math.round(progressPercent)),
      statusColor,
      dailyGoal
    });
  }

  const monthlyProgressPercent = Math.min(100, Math.round((totalInterpreted / monthlyGoal) * 100));

  return {
    interpreterId,
    interpreterName: interpreter.name,
    interpreterExternalId: interpreter.externalId,
    monthlyGoal,
    dailyGoal,
    totalInterpreted,
    monthlyProgressPercent,
    history: dailyHistory.reverse() // Mostramos el más reciente primero
  };
}
