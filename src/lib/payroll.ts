import prisma from './prisma';
import { Prisma } from '@prisma/client';

interface PayrollInput {
  interpreterId: number;
  periodStart: Date;
  periodEnd: Date;
}

interface PayrollCalculation {
  totalMinutes: number;
  grossTotal: number;
  qualityBonus: number;
  penalidades: number;
  netTotal: number;
}

/**
 * Calcula nómina para un intérprete en un período específico
 * Usa connection pooling optimizado para Vercel/Supabase gratuito
 */
export async function calculatePayroll(
  input: PayrollInput
): Promise<PayrollCalculation> {
  const { interpreterId, periodStart, periodEnd } = input;

  // Query quirúrgica: solo datos necesarios
  const interpreter = await prisma.interpreter.findUnique({
    where: { id: interpreterId },
    select: {
      id: true,
      tariffPerMinute: true,
    },
  });

  if (!interpreter) {
    throw new Error(`Interpreter ${interpreterId} not found`);
  }

  // Obtener logs de producción en el período (Importados)
  const productionLogs = await prisma.productionLog.findMany({
    where: {
      interpreterId,
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      id: true,
      interpretedMinutes: true,
      adherence: true,
    },
  });

  // Obtener logs de llamadas en tiempo real (call_sessions)
  const callSessions: any[] = await prisma.$queryRaw`
    SELECT duration_seconds, call_cost 
    FROM public.call_sessions 
    WHERE interpreter_id = ${interpreterId}
    AND started_at >= ${periodStart} 
    AND started_at <= ${periodEnd}
    AND ended_at IS NOT NULL
  `;

  // Obtener scores de QA
  const qaScores = await prisma.qAScore.findMany({
    where: {
      interpreterId,
      auditDate: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      totalScore: true,
      criticalError: true,
    },
  });

  // Cálculos de minutos
  const importedMinutes = productionLogs.reduce(
    (sum: number, log) => sum + log.interpretedMinutes,
    0
  );
  const realtimeMinutes = Math.round(
    callSessions.reduce((sum: number, call) => sum + (call.duration_seconds || 0), 0) / 60
  );
  
  const totalMinutes = importedMinutes + realtimeMinutes;

  // Cálculos de costos
  const importedCost = importedMinutes * parseFloat(interpreter.tariffPerMinute.toString());
  const realtimeCost = callSessions.reduce((sum: number, call) => sum + parseFloat(call.call_cost || '0'), 0);
  
  const grossTotal = importedCost + realtimeCost;

  // Bonus de calidad: +5% si promedio QA >= 90%
  let qualityBonus = 0;
  if (qaScores.length > 0) {
    const avgQA =
      qaScores.reduce((sum: number, qa) => sum + (qa.totalScore?.toNumber() || 0), 0) /
      qaScores.length;
    if (avgQA >= 90) {
      qualityBonus = grossTotal * 0.05;
    }
  }

  // Penalidades: -10% por error crítico
  let penalidades = 0;
  const criticalErrors = qaScores.filter((qa) => qa.criticalError).length;
  if (criticalErrors > 0) {
    penalidades = grossTotal * 0.1 * criticalErrors;
  }

  // Deducción de transferencia: 1-2% del monto neto
  const subtotal = grossTotal + qualityBonus - penalidades;
  const transferDeduction = subtotal * 0.015; // 1.5%

  const netTotal = subtotal - transferDeduction;

  return {
    totalMinutes,
    grossTotal: Math.round(grossTotal * 100) / 100,
    qualityBonus: Math.round(qualityBonus * 100) / 100,
    penalidades: Math.round(penalidades * 100) / 100,
    netTotal: Math.round(netTotal * 100) / 100,
  };
}

/**
 * Crea registro de nómina en BD
 */
export async function createPayrollRecord(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const calculation = await calculatePayroll({
    interpreterId,
    periodStart,
    periodEnd,
  });

  const record = await prisma.payrollRecord.create({
    data: {
      interpreterId,
      periodStart,
      periodEnd,
      totalMinutes: calculation.totalMinutes,
      grossTotal: new Prisma.Decimal(calculation.grossTotal),
      qualityBonus: new Prisma.Decimal(calculation.qualityBonus),
      penalidades: new Prisma.Decimal(calculation.penalidades),
      transferDeduction: new Prisma.Decimal(calculation.netTotal * 0.015),
      netTotal: new Prisma.Decimal(calculation.netTotal),
      status: 'Pendiente',
    },
  });

  return record;
}

/**
 * Calcula payroll para múltiples intérpretes (batch)
 * Optimizado para no generar N+1 queries
 */
export async function calculateBatchPayroll(
  interpreterIds: number[],
  periodStart: Date,
  periodEnd: Date
) {
  const results = await Promise.all(
    interpreterIds.map((id) =>
      calculatePayroll({ interpreterId: id, periodStart, periodEnd })
    )
  );

  return results;
}
