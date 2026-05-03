import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma'; // Assuming this is the standard location

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { logId, verifiedMinutes } = body;

    if (!logId || verifiedMinutes === undefined) {
      return NextResponse.json(
        { error: 'logId and verifiedMinutes are required' },
        { status: 400 }
      );
    }

    // 1. Fetch the log
    const log = await prisma.productionLog.findUnique({
      where: { id: logId }
    });

    if (!log) {
      return NextResponse.json({ error: 'Production log not found' }, { status: 404 });
    }

    // 2. Check if linked to a PAID payroll record
    const linkedPaidPayroll = await prisma.payrollRecord.findFirst({
      where: {
        interpreterId: log.interpreterId,
        status: 'PAID',
        periodStart: { lte: log.date },
        periodEnd: { gte: log.date }
      }
    });

    if (linkedPaidPayroll) {
      return NextResponse.json(
        { error: 'Cannot modify verifiedMinutes: Log is linked to a PAID payroll record' },
        { status: 403 }
      );
    }

    // 3. Update the log
    const updatedLog = await (prisma.productionLog as any).update({
      where: { id: logId },
      data: { verifiedMinutes: Number(verifiedMinutes) }
    });

    return NextResponse.json({ success: true, data: updatedLog });
  } catch (error: any) {
    console.error('Error in /api/reconcile:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
