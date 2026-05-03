import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
type Decimal = Prisma.Decimal;

const db = prisma as any;

// ============================================================
// PayrollService — Motor de Nómina e Incentivos
// Lógica aislada para cálculos financieros contra SystemConfig
// ============================================================

/** Estructura de un tier de incentivos leído desde SystemConfig */
interface IncentiveTier {
  minHours: number;
  bonus: number; // Decimal amount stored as number for calc
}

/** Resultado del cálculo unificado de tiempo */
interface UnifiedTimeResult {
  importedMinutes: number;
  realtimeMinutes: number;
  totalMinutes: number;
  totalHours: number;
}

/** Resultado del cálculo completo de incentivos */
interface IncentiveResult {
  totalIncentive: number;
  matchedTier: string | null; // Key name of the matched tier
}

/** Resultado completo del motor de nómina con incentivos */
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
 *   key: "tier1_hours" → value: "100"  (horas mínimas)
 *   key: "tier1_bonus" → value: "50.00" (monto bono)
 *   key: "tier2_hours" → value: "150"
 *   key: "tier2_bonus" → value: "100.00"
 *   key: "tier3_hours" → value: "200"
 *   key: "tier3_bonus" → value: "200.00"
 */
export async function getIncentiveTiers(): Promise<IncentiveTier[]> {
  const configs = await db.systemConfig.findMany({
    where: {
      key: {
        startsWith: 'tier',
      },
    },
  });

  // Agrupa por número de tier
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

  // Orden descendente: el tier más alto primero para que matchee el mejor bono
  tiers.sort((a, b) => b.minHours - a.minHours);

  return tiers;
}

/**
 * Unifica las horas de production_logs y call_sessions
 * para un intérprete en un período dado.
 */
export async function calculateUnifiedTime(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<UnifiedTimeResult> {
  // 1. Minutos de production_logs (CSV imports)
  const productionLogs = await db.productionLog.findMany({
    where: {
      interpreterId,
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { interpretedMinutes: true },
  });

  const importedMinutes = (productionLogs || []).reduce(
    (sum: number, log: { interpretedMinutes: number }) => sum + log.interpretedMinutes,
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
 * Calcula el bono de incentivo dinámicamente basado en los tiers de SystemConfig.
 * Retorna el bono del tier más alto que el intérprete haya alcanzado.
 */
export async function calculateIncentive(totalHours: number): Promise<IncentiveResult> {
  const tiers = await getIncentiveTiers();

  // Busca el tier más alto alcanzado (ya están ordenados descendente)
  for (const tier of tiers) {
    if (totalHours >= tier.minHours) {
      // Reconstruir el key para saber cuál tier matcheó
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
 * Motor de cálculo completo: unifica tiempo + incentivos + QA + penalidades.
 * Fórmula base: (totalMinutes) × tariffPerMinute = grossTotal
 */
export async function calculateFullPayroll(
  interpreterId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<PayrollCalculationResult> {
  // 1. Obtener intérprete
  const interpreter = await db.interpreter.findUnique({
    where: { id: interpreterId },
    select: {
      id: true,
      name: true,
      tariffPerMinute: true,
    },
  });

  if (!interpreter) {
    throw new Error(`Interpreter ${interpreterId} not found`);
  }

  const tariffPerMinute = parseFloat(interpreter.tariffPerMinute.toString());

  // 2. Tiempo unificado
  const time = await calculateUnifiedTime(interpreterId, periodStart, periodEnd);

  // 3. Gross total: totalMinutes × tariffPerMinute
  const grossTotal = Math.round(time.totalMinutes * tariffPerMinute * 100) / 100;

  // 4. Incentivos dinámicos desde SystemConfig
  const incentive = await calculateIncentive(time.totalHours);

  // 5. Quality bonus (QA)
  let qualityBonus = 0;
  const qaScores = await db.qAScore.findMany({
    where: {
      interpreterId,
      auditDate: { gte: periodStart, lte: periodEnd },
    },
    select: { totalScore: true, criticalError: true },
  });

  if (qaScores && qaScores.length > 0) {
    const avgQA =
      qaScores.reduce(
        (sum: number, qa: { totalScore: Decimal | null }) =>
          sum + (parseFloat(qa.totalScore?.toString() || '0')),
        0
      ) / qaScores.length;
    if (avgQA >= 90) {
      qualityBonus = Math.round(grossTotal * 0.05 * 100) / 100;
    }
  }

  // 6. Penalidades por errores críticos
  let penalidades = 0;
  const criticalErrors = (qaScores || []).filter(
    (qa: { criticalError: boolean }) => qa.criticalError
  ).length;
  if (criticalErrors > 0) {
    penalidades = Math.round(grossTotal * 0.1 * criticalErrors * 100) / 100;
  }

  // 7. Net total
  const subtotal = grossTotal + qualityBonus + incentive.totalIncentive - penalidades;
  const transferDeduction = Math.round(subtotal * 0.015 * 100) / 100;
  const netTotal = Math.round((subtotal - transferDeduction) * 100) / 100;

  return {
    interpreterId: interpreter.id,
    interpreterName: interpreter.name,
    totalMinutes: time.totalMinutes,
    totalHours: time.totalHours,
    tariffPerMinute,
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
 * Usa verifiedMinutes en lugar de totalMinutes para el cálculo.
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

  const tariffPerMinute = parseFloat(record.interpreter.tariffPerMinute.toString());
  const grossTotal = Math.round(verifiedMinutes * tariffPerMinute * 100) / 100;

  // Recalcular incentivo con las horas verificadas
  const verifiedHours = Math.round((verifiedMinutes / 60) * 100) / 100;
  const incentive = await calculateIncentive(verifiedHours);

  // Mantener qualityBonus y penalidades originales
  const qualityBonus = parseFloat(record.qualityBonus.toString());
  const penalidades = parseFloat(record.penalidades.toString());

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
