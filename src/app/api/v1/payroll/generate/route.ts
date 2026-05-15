import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { ProductionLog } from '@prisma/client';
import { calculateFullPayroll } from '@/services/PayrollService';

export async function POST(request: Request) {
  try {
    const { targetDate } = await request.json().catch(() => ({}));
    const dateToProcess = targetDate ? new Date(targetDate) : new Date();
    
    // Get day of month and day of week
    const dayOfMonth = dateToProcess.getDate().toString();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[dateToProcess.getDay()];

    // Find all interpreters that are scheduled to be paid today
    const interpreters = await prisma.interpreter.findMany({
      where: {
        status: 'Activo',
        OR: [
          { paymentFrequency: 'Monthly', paymentDay: dayOfMonth },
          { paymentFrequency: 'Weekly', paymentDay: dayOfWeek },
          { paymentFrequency: 'Biweekly', paymentDay: dayOfWeek } // Would need logic for every other week, simplifying for now
        ]
      }
    });

    if (interpreters.length === 0) {
      return NextResponse.json({ message: 'No interpreters scheduled for payment today', count: 0 });
    }

    const results = [];

    // Process each interpreter atomically
    for (const interpreter of interpreters) {
      // Find all unprocessed logs
      const unprocessedLogs = await prisma.productionLog.findMany({
        where: {
          interpreterId: interpreter.id,
          status: { not: 'PROCESSED' }
        }
      });

      if (unprocessedLogs.length === 0) continue;

      // Calculate using unified PayrollService
      const periodStartLogs = new Date(Math.min(...unprocessedLogs.map((l: ProductionLog) => l.date.getTime())));
      const periodEndLogs = new Date(Math.max(...unprocessedLogs.map((l: ProductionLog) => l.date.getTime())));
      
      const calculation = await calculateFullPayroll(interpreter.id, periodStartLogs, periodEndLogs);

      const periodStart = periodStartLogs;
      const periodEnd = periodEndLogs;

      // Unique reconciliation hash
      const reconciliationHash = crypto.createHash('sha256').update(`${interpreter.id}-${periodStart.toISOString()}-${periodEnd.toISOString()}-${Date.now()}`).digest('hex');

      try {
        // Atomic transaction
        const result = await prisma.$transaction(async (tx) => {
          const payroll = await tx.payrollRecord.create({
            data: {
              interpreterId: interpreter.id,
              periodStart,
              periodEnd,
              totalMinutes: calculation.totalMinutes,
              verifiedMinutes: calculation.totalMinutes, // Using totalMinutes as verified since it represents the processed amount
              grossTotal: calculation.grossTotal,
              qualityBonus: calculation.qualityBonus,
              incentivesTotal: calculation.incentivesTotal,
              penalidades: calculation.penalidades,
              transferDeduction: calculation.transferDeduction,
              netTotal: calculation.netTotal,
              status: 'PENDING',
              reconciliationHash
            }
          });

          // Mark logs as processed
          await tx.productionLog.updateMany({
            where: {
              id: { in: unprocessedLogs.map((l: ProductionLog) => l.id) }
            },
            data: {
              status: 'PROCESSED'
            }
          });

          return payroll;
        });
        
        results.push({ interpreterId: interpreter.id, payrollId: result.id, status: 'Success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results.push({ interpreterId: interpreter.id, error: message, status: 'Failed' });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
