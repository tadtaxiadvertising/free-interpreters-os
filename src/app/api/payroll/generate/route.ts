import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { ProductionLog } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { targetDate } = await request.json().catch(() => ({}));
    const dateToProcess = targetDate ? new Date(targetDate) : new Date();
    
    // Get day of month and day of week
    const dayOfMonth = dateToProcess.getDate().toString();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[dateToProcess.getDay()];

    // Find all interpreters that are scheduled to be paid today
    const interpreters = await (prisma.interpreter as any).findMany({
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

      // Calculate totals
      let totalMinutes = 0;
      let totalVerified = 0;
      let usedVerified = false;

      for (const log of unprocessedLogs as any[]) {
        if (log.verifiedMinutes !== null && log.verifiedMinutes !== undefined) {
          totalVerified += log.verifiedMinutes;
          totalMinutes += log.verifiedMinutes;
          usedVerified = true;
        } else {
          totalMinutes += log.interpretedMinutes || 0;
        }
      }

      const grossTotal = totalMinutes * Number(interpreter.tariffPerMinute);
      const qualityBonus = 0; // Or calculate from QAScores
      const incentivesTotal = 0;
      const penalidades = 0;
      const transferDeduction = 0;
      const netTotal = grossTotal + qualityBonus + incentivesTotal - penalidades - transferDeduction;

      // Generate period range based on logs
      const dates = unprocessedLogs.map((l: ProductionLog) => l.date);
      const periodStart = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
      const periodEnd = new Date(Math.max(...dates.map((d: Date) => d.getTime())));

      // Unique reconciliation hash
      const reconciliationHash = crypto.createHash('sha256').update(`${interpreter.id}-${periodStart.toISOString()}-${periodEnd.toISOString()}-${Date.now()}`).digest('hex');

      try {
        // Atomic transaction
        const result = await prisma.$transaction(async (tx: any) => {
          const payroll = await tx.payrollRecord.create({
            data: {
              interpreterId: interpreter.id,
              periodStart,
              periodEnd,
              totalMinutes,
              verifiedMinutes: usedVerified ? totalVerified : null,
              grossTotal,
              qualityBonus,
              incentivesTotal,
              penalidades,
              transferDeduction,
              netTotal,
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
      } catch (err: any) {
        results.push({ interpreterId: interpreter.id, error: err.message, status: 'Failed' });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Error in /api/payroll/generate:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
