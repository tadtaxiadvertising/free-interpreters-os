import prisma from './prisma';

const db = prisma;

import { calculateFullPayroll } from '@/services/PayrollService';

interface PayrollInput {
  interpreterId: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Calcula nómina para un intérprete en un período específico
 * Usando el motor unificado de PayrollService
 */
export async function calculatePayroll(
  input: PayrollInput
) {
  return calculateFullPayroll(input.interpreterId, input.periodStart, input.periodEnd);
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
      incentivesTotal: calculation.incentivesTotal,
      penalidades: calculation.penalidades,
      transferDeduction: calculation.transferDeduction,
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

