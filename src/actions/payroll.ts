'use server';

import prisma from '@/lib/prisma';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const CalculatePayrollSchema = z.object({
  interpreterId: z.coerce.number().int().positive(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export async function calculateInterpreterPayrollAction(
  prevState: any,
  formData: FormData
) {
  try {
    const interpreterId = formData.get('interpreterId');
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');

    const validated = CalculatePayrollSchema.parse({ interpreterId, startDate, endDate });

    return await prisma.$transaction(async (tx) => {
      // Find unsettled production logs within date range
      const unsettledLogs = await tx.productionLog.findMany({
        where: {
          interpreterId: validated.interpreterId,
          isSettled: false,
          date: {
            gte: validated.startDate,
            lte: validated.endDate,
          },
        },
      });

      // Find unsettled call sessions within date range
      const unsettledSessions = await tx.callSession.findMany({
        where: {
          interpreterId: validated.interpreterId,
          isSettled: false,
          startedAt: {
            gte: validated.startDate,
            lte: validated.endDate,
          },
        },
      });

      if (unsettledLogs.length === 0 && unsettledSessions.length === 0) {
        return { success: false, error: 'No unsettled minutes found for the selected period. All records are locked.' };
      }

      // Calculate totals
      let totalMinutes = 0;
      
      for (const log of unsettledLogs) {
        totalMinutes += log.verifiedMinutes || log.interpretedMinutes || 0;
      }

      for (const session of unsettledSessions) {
        if (session.durationSeconds) {
          totalMinutes += Math.round(session.durationSeconds / 60);
        }
      }

      const interpreter = await tx.interpreter.findUnique({
        where: { id: validated.interpreterId },
        select: { tariffPerMinute: true },
      });

      if (!interpreter) {
        throw new Error('Interpreter not found');
      }

      const tariff = Number(interpreter.tariffPerMinute);
      const grossTotal = totalMinutes * tariff;

      // Create new payroll_records entry
      const newPayroll = await tx.payrollRecord.create({
        data: {
          interpreterId: validated.interpreterId,
          periodStart: validated.startDate,
          periodEnd: validated.endDate,
          totalMinutes: totalMinutes,
          grossTotal: grossTotal,
          netTotal: grossTotal, // Net total initially equals gross before bonuses/penalties
          status: 'Draft',
        },
      });

      // Update previously queried production_logs
      if (unsettledLogs.length > 0) {
        await tx.productionLog.updateMany({
          where: {
            id: {
              in: unsettledLogs.map(log => log.id),
            },
          },
          data: {
            isSettled: true,
            payrollRecordId: newPayroll.id,
          },
        });
      }

      // Update previously queried call_sessions
      if (unsettledSessions.length > 0) {
        await tx.callSession.updateMany({
          where: {
            id: {
              in: unsettledSessions.map(session => session.id),
            },
          },
          data: {
            isSettled: true,
            payrollRecordId: newPayroll.id,
          },
        });
      }

      revalidatePath('/payroll');
      
      return { 
        success: true, 
        message: `Payroll calculated successfully. Locked ${totalMinutes} minutes.`,
      };
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input data: ' + error.errors[0].message };
    }
    console.error('Calculate Payroll Error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred during calculation.' };
  }
}
