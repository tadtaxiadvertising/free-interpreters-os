import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;

const db = prisma;

// ============================================================
// PayrollService â€” Motor de NÃ³mina e Incentivos
// LÃ³gica aislada para cÃ¡lculos financieros contra SystemConfig
// ============================================================

/** Estructura de un tier de incentivos leÃ­do desde SystemConfig */
interface IncentiveTier {
  minHours: number;
  bonus: number; // Decimal amount stored as number for calc
}

/** Resultado del cÃ¡lculo unificado de tiempo */
interface UnifiedTimeResult {
  importedMinutes: number;
  realtimeMinutes: number;
  totalMinutes: number;
  totalHours: number;
}

/** Resultado del cÃ¡lculo completo de incentivos */
interface IncentiveResult {
  totalIncentive: number;
  matchedTier: string | null; // Key name of the matched tier
}

interface ProductionLogRecord {
  interpretedMinutes: number | null;
  verifiedMinutes: number | null;
  accountId: number | null;
}

interface CallSessionRecord {
  durationSeconds: number | null;
  callCost: Prisma.Decimal | null;
}

interface QAScoreRecord {
  totalScore: Prisma.Decimal | null;
  criticalError: boolean | null;
}

/** Resultado completo del motor de nÃ³mina con incentivos */
export interface PayrollCalculationResult {
  interpreterId: number;
  interpreterName: string;
  totalMinutes: number;
  totalHours: number;
  tariffPerMinute: number;
  grossTotal: number;
  incentivesTotal: number;
  matchedTier: string | null;
  qualityBonus: number;
  penalidades: number;
  transferDeduction: number;
  netTotal: number;
}

/**
 * Lee los tiers de incentivos desde la tabla SystemConfig.
 * Formato esperado en DB:
 *   key: "tier1_hours" â†’ value: "100"  (horas mÃ­nimas)
 *   key: "tier1_bonus" â†’ value: "50.00" (monto bono)
 *   key: "tier2_hours" â†’ value: "150"
 *   key: "tier2_bonus" â†’ value: "100.00"
 *   key: "tier3_hours" â†’ value: "200"
 *   key: "tier3_bonus" â†’ value: "200.00"
 */
export async function getIncentiveTiers(): Promise<IncentiveTier[]> {
  const configs = await db.systemConfig.findMany({
    where: {
      key: {
        startsWith: 'tier',
      },
    },
  });

  // Agrupa por nÃºmero de tier
  const tierMap = new Map<number, Partial<IncentiveTier>>();

  for (const config of configs) {
    const match = config.key.match(/^tier(\d+)_(hours|bonus)$/);
    if (!match) continue;

    const tierNum = parseInt(match[1], 10);
    const field = match[2]; // 'hours' or 'bonus'

    if (!tierMap.has(tierNum)) {
      tierMap.set(tierNum, {});
    }

    const tier = tierMap.get(tierNum)!;
    if (field === 'hours') {
      tier.minHours = parseInt(config.value, 10);
    } else if (field === 'bonus') {
      tier.bonus = parseFloat(config.value);
    }
  }

  // Filtra tiers completos y ordena descendente por horas para matching
  const tiers: IncentiveTier[] = [];
  for (const [, partial] of tierMap) {
    if (partial.minHours != null && partial.bonus != null) {
      tiers.push({ minHours: partial.minHours, bonus: partial.bonus });
    }
  }

  // Orden descendente: el tier mÃ¡s alto primero para que matchee el mejor bono
  tiers.sort((a, b) => b.minHours - a.minHours);

  return tiers;
}

/**
 * Unifica las horas de production_logs y call_sessions
 * para un intÃ©rprete en un perÃ­odo dado.
 */
export async function calculateUnifiedTime(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<UnifiedTimeResult> {
  // 1. Minutos de production_logs (CSV imports + Manual logs)
  const productionLogs = await db.productionLog.findMany({
    where: {
      interpreterId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { interpretedMinutes: true, verifiedMinutes: true, accountId: true },
  }) as ProductionLogRecord[];

  const importedMinutes = (productionLogs || []).reduce(
    (sum: number, log: ProductionLogRecord) => {
      const effectiveMinutes = log.verifiedMinutes !== null ? log.verifiedMinutes : (log.interpretedMinutes || 0);
      return sum + effectiveMinutes;
    },
    0
  );

  // 2. Minutos de call_sessions (timer en vivo)
  const callSessions = await db.callSession.findMany({
    where: {
      interpreterId,
      startedAt: { gte: periodStart, lte: periodEnd },
      endedAt: { not: null },
    },
    select: { durationSeconds: true },
  });

  const totalSeconds = (callSessions || []).reduce(
    (sum: number, call: { durationSeconds: number | null }) => sum + (call.durationSeconds || 0),
    0
  );
  const realtimeMinutes = Math.round(totalSeconds / 60);

  const totalMinutes = importedMinutes + realtimeMinutes;
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  return { importedMinutes, realtimeMinutes, totalMinutes, totalHours };
}

/**
 * Calcula el bono de incentivo dinÃ¡micamente basado en los tiers de SystemConfig.
 * Retorna el bono del tier mÃ¡s alto que el intÃ©rprete haya alcanzado.
 */
export async function calculateIncentive(totalHours: number): Promise<IncentiveResult> {
  const tiers = await getIncentiveTiers();

  // Busca el tier mÃ¡s alto alcanzado (ya estÃ¡n ordenados descendente)
  for (const tier of tiers) {
    if (totalHours >= tier.minHours) {
      // Reconstruir el key para saber cuÃ¡l tier matcheÃ³
      const tierIndex = tiers.indexOf(tier);
      const tierName = `tier${tiers.length - tierIndex}`;
      return {
        totalIncentive: tier.bonus,
        matchedTier: tierName,
      };
    }
  }

  return { totalIncentive: 0, matchedTier: null };
}

/**
 * Motor de cÃ¡lculo completo: unifica tiempo + incentivos + QA + penalidades.
 * FÃ³rmula base: (totalMinutes) Ã— tariffPerMinute = grossTotal
 */
export async function calculateFullPayroll(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<PayrollCalculationResult> {
  // 1. Obtener intérprete y sus tasas por cuenta
  const interpreter = await db.interpreter.findUnique({
    where: { id: interpreterId },
    select: {
      id: true,
      name: true,
      tariffPerMinute: true,
      accountRates: true
    },
  });

  if (!interpreter) {
    throw new Error(`Interpreter ${interpreterId} not found`);
  }

  const baseRatePerMinute = parseFloat(interpreter.tariffPerMinute.toString());

  // 2. Obtener logs de producción para cálculo detallado de costos
  const productionLogs = await db.productionLog.findMany({
    where: {
      interpreterId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { interpretedMinutes: true, verifiedMinutes: true, accountId: true },
  }) as ProductionLogRecord[];

  // 3. Obtener logs de llamadas en tiempo real
  const callSessions = await db.callSession.findMany({
    where: {
      interpreterId,
      startedAt: { gte: periodStart, lte: periodEnd },
      endedAt: { not: null },
    },
    select: { durationSeconds: true, callCost: true },
  }) as unknown as CallSessionRecord[];

  // 4. Cálculos de Minutos
  const importedMinutes = (productionLogs || []).reduce((sum: number, log: ProductionLogRecord) => {
    return sum + (log.verifiedMinutes !== null ? log.verifiedMinutes : (log.interpretedMinutes || 0));
  }, 0);
  const realtimeMinutes = Math.round((callSessions || []).reduce((sum: number, call: CallSessionRecord) => sum + (call.durationSeconds || 0), 0) / 60);
  const totalMinutes = importedMinutes + realtimeMinutes;
  const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

  // 5. Cálculo de Gross Total (respetando accountRates y verifiedMinutes)
  let importedCost = 0;
  for (const log of (productionLogs || [])) {
    let ratePerMinute = baseRatePerMinute;
    if (log.accountId) {
      const specificRate = interpreter.accountRates?.find((r: { accountId: number | null }) => r.accountId === log.accountId);
      if (specificRate) {
        ratePerMinute = parseFloat(specificRate.tariffPerHour.toString()) / 60;
      }
    }
    const effectiveMinutes = log.verifiedMinutes !== null ? log.verifiedMinutes : (log.interpretedMinutes || 0);
    importedCost += effectiveMinutes * ratePerMinute;
  }

  const realtimeCost = (callSessions || []).reduce((sum: number, call: CallSessionRecord) => sum + parseFloat(call.callCost?.toString() || '0'), 0);
  const grossTotal = Math.round((importedCost + realtimeCost) * 100) / 100;

  // 6. Incentivos dinámicos desde SystemConfig
  const incentive = await calculateIncentive(totalHours);

  // 7. Quality bonus (QA) con Regla de Auto-Fail
  let qualityBonus = 0;
  const qaScores = await db.qAScore.findMany({
    where: {
      interpreterId,
      auditDate: { gte: periodStart, lte: periodEnd },
    },
    select: { totalScore: true, criticalError: true },
  }) as QAScoreRecord[];

  if (qaScores && qaScores.length > 0) {
    const avgQA = qaScores.reduce((sum: number, qa: QAScoreRecord) => {
      // Auto-Fail Rule: if criticalError === true, QA score counts as 0.00
      const score = qa.criticalError ? 0 : (parseFloat(qa.totalScore?.toString() || '0') || 0);
      return sum + score;
    }, 0) / qaScores.length;

    if (avgQA >= 90) {
      qualityBonus = Math.round(grossTotal * 0.05 * 100) / 100;
    }
  }

  // 8. Penalidades por errores críticos (10% del gross por cada uno)
  let penalidades = 0;
  const criticalErrors = (qaScores || []).filter((qa: QAScoreRecord) => qa.criticalError).length;
  if (criticalErrors > 0) {
    penalidades = Math.round(grossTotal * 0.1 * criticalErrors * 100) / 100;
  }

  // 9. Net total
  const subtotal = grossTotal + qualityBonus + incentive.totalIncentive - penalidades;
  const transferDeduction = Math.round(subtotal * 0.015 * 100) / 100;
  const netTotal = Math.round((subtotal - transferDeduction) * 100) / 100;

  return {
    interpreterId: interpreter.id,
    interpreterName: interpreter.name,
    totalMinutes,
    totalHours,
    tariffPerMinute: baseRatePerMinute,
    grossTotal,
    incentivesTotal: incentive.totalIncentive,
    matchedTier: incentive.matchedTier,
    qualityBonus,
    penalidades,
    transferDeduction,
    netTotal,
  };
}

/**
 * Recalcula netTotal cuando el admin sobrescribe los minutos verificados.
 * Usa verifiedMinutes en lugar de totalMinutes para el cÃ¡lculo.
 */
export async function recalculateWithVerifiedMinutes(
  payrollRecordId: string,
  verifiedMinutes: number
): Promise<{
  grossTotal: number;
  incentivesTotal: number;
  transferDeduction: number;
  netTotal: number;
}> {
  const record = await db.payrollRecord.findUnique({
    where: { id: payrollRecordId },
    include: {
      interpreter: {
        select: { tariffPerMinute: true },
      },
    },
  });

  if (!record) {
    throw new Error(`PayrollRecord ${payrollRecordId} not found`);
  }

  const tariffPerMinute = record.interpreter ? parseFloat(record.interpreter.tariffPerMinute.toString()) : 0;
  const grossTotal = Math.round(verifiedMinutes * tariffPerMinute * 100) / 100;

  // Recalcular incentivo con las horas verificadas
  const verifiedHours = Math.round((verifiedMinutes / 60) * 100) / 100;
  const incentive = await calculateIncentive(verifiedHours);

  // Mantener qualityBonus y penalidades originales
  const qualityBonus = record.qualityBonus ? parseFloat(record.qualityBonus.toString()) : 0;
  const penalidades = record.penalidades ? parseFloat(record.penalidades.toString()) : 0;

  const subtotal = grossTotal + qualityBonus + incentive.totalIncentive - penalidades;
  const transferDeduction = Math.round(subtotal * 0.015 * 100) / 100;
  const netTotal = Math.round((subtotal - transferDeduction) * 100) / 100;

  return {
    grossTotal,
    incentivesTotal: incentive.totalIncentive,
    transferDeduction,
    netTotal,
  };
}

/**
 * Busca y actualiza un registro de nómina existente si está en estado 'Pendiente' o 'PENDING'.
 * Útil después de conciliar minutos en un productionLog.
 */
export async function refreshPayrollRecord(
  interpreterId: number,
  dateWithinPeriod: Date
): Promise<void> {
  const record = await db.payrollRecord.findFirst({
    where: {
      interpreterId,
      periodStart: { lte: dateWithinPeriod },
      periodEnd: { gte: dateWithinPeriod },
      status: { in: ['Pendiente', 'PENDING'] }
    }
  });

  if (record) {
    const calc = await calculateFullPayroll(interpreterId, record.periodStart, record.periodEnd);
    await db.payrollRecord.update({
      where: { id: record.id },
      data: {
        totalMinutes: calc.totalMinutes,
        grossTotal: calc.grossTotal,
        qualityBonus: calc.qualityBonus,
        incentivesTotal: calc.incentivesTotal,
        penalidades: calc.penalidades,
        transferDeduction: calc.transferDeduction,
        netTotal: calc.netTotal,
        verifiedMinutes: calc.totalMinutes
      }
    });
  }
}
