import prisma from './prisma';

const db = prisma as any;

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
 * Optimizado usando Prisma para evitar DNS lookups
 */
export async function calculatePayroll(
  input: PayrollInput
): Promise<PayrollCalculation> {
  const { interpreterId, periodStart, periodEnd } = input;

  // 1. Obtener datos del intérprete y sus tasas por cuenta via Prisma
  const interpreter = await db.interpreter.findUnique({
    where: { id: interpreterId },
    select: {
      id: true,
      tariffPerMinute: true,
      accountRates: true
    }
  });

  if (!interpreter) {
    throw new Error(`Interpreter ${interpreterId} not found`);
  }

  // 2. Obtener logs de producción via Prisma
  const productionLogs = await db.productionLog.findMany({
    where: {
      interpreterId: interpreterId,
      date: {
        gte: periodStart,
        lte: periodEnd
      }
    },
    select: {
      id: true,
      interpretedMinutes: true,
      verifiedMinutes: true, // Prioritized over interpretedMinutes when present
      accountId: true
    }
  });

  // 3. Obtener logs de llamadas en tiempo real via Prisma
  const callSessions = await db.callSession.findMany({
    where: {
      interpreterId: interpreterId,
      startedAt: {
        gte: periodStart,
        lte: periodEnd
      },
      endedAt: {
        not: null
      }
    },
    select: {
      durationSeconds: true,
      callCost: true
    }
  });

  // 4. Obtener scores de QA via Prisma
  const qaScores = await db.qAScore.findMany({
    where: {
      interpreterId: interpreterId,
      auditDate: {
        gte: periodStart,
        lte: periodEnd
      }
    },
    select: {
      totalScore: true,
      criticalError: true
    }
  });

  // Cálculos de minutos — prioriza verifiedMinutes sobre interpretedMinutes
  const importedMinutes = (productionLogs || []).reduce((sum: number, log: any) => {
    const effectiveMinutes = log.verifiedMinutes != null ? log.verifiedMinutes : log.interpretedMinutes;
    return sum + effectiveMinutes;
  }, 0);
  const realtimeMinutes = Math.round((callSessions || []).reduce((sum: number, call: any) => sum + (call.durationSeconds || 0), 0) / 60);
  const totalMinutes = importedMinutes + realtimeMinutes;

  // Cálculos de costos
  let importedCost = 0;
  const baseRatePerMinute = parseFloat(interpreter.tariffPerMinute.toString());

  for (const log of (productionLogs || [])) {
    let ratePerMinute = baseRatePerMinute;
    if (log.accountId) {
      const specificRate = interpreter.accountRates.find((r: any) => r.accountId === log.accountId);
      if (specificRate) {
        ratePerMinute = parseFloat(specificRate.tariffPerHour.toString()) / 60;
      }
    }
    // Use verifiedMinutes when available for cost calculation
    const effectiveMinutes = log.verifiedMinutes != null ? log.verifiedMinutes : log.interpretedMinutes;
    importedCost += effectiveMinutes * ratePerMinute;
  }

  const realtimeCost = (callSessions || []).reduce((sum: number, call: any) => sum + parseFloat(call.callCost?.toString() || '0'), 0);
  const grossTotal = importedCost + realtimeCost;

  // Bonus de calidad: +5% si promedio QA >= 90%
  // Auto-Fail Rule: if criticalError === true, QA score counts as 0.00
  let qualityBonus = 0;
  if (qaScores && qaScores.length > 0) {
    const avgQA = qaScores.reduce((sum: number, qa: any) => {
      const score = qa.criticalError ? 0 : (parseFloat(qa.totalScore?.toString()) || 0);
      return sum + score;
    }, 0) / qaScores.length;
    if (avgQA >= 90) {
      qualityBonus = grossTotal * 0.05;
    }
  }

  // Penalidades: -10% por error crítico
  let penalidades = 0;
  const criticalErrors = (qaScores || []).filter((qa: any) => qa.criticalError).length;
  if (criticalErrors > 0) {
    penalidades = grossTotal * 0.1 * criticalErrors;
  }

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

export async function createPayrollRecord(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
) {
  const calculation = await calculatePayroll({ interpreterId, periodStart, periodEnd });

  const record = await db.payrollRecord.create({
    data: {
      interpreterId: interpreterId,
      periodStart: periodStart,
      periodEnd: periodEnd,
      totalMinutes: calculation.totalMinutes,
      grossTotal: calculation.grossTotal,
      qualityBonus: calculation.qualityBonus,
      penalidades: calculation.penalidades,
      transferDeduction: Math.round(calculation.netTotal * 0.015 * 100) / 100,
      netTotal: calculation.netTotal,
      status: 'Pendiente'
    }
  });

  return record;
}

export async function calculateBatchPayroll(
  interpreterIds: number[],
  periodStart: Date,
  periodEnd: Date
) {
  const results = await Promise.all(
    interpreterIds.map((id) => calculatePayroll({ interpreterId: id, periodStart, periodEnd }))
  );
  return results;
}

