import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { payrollRecordId, transactionReference } = body;

    if (!payrollRecordId) {
      return NextResponse.json(
        { error: 'payrollRecordId is required' },
        { status: 400 }
      );
    }

    if (!transactionReference || transactionReference.trim() === '') {
      return NextResponse.json(
        { error: 'transactionReference is required for marking payment as PAID' },
        { status: 400 }
      );
    }

    // Check if payroll record exists and is in APPROVED state
    const payroll = await prisma.payrollRecord.findUnique({
      where: { id: payrollRecordId }
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
    }

    if (payroll.status !== 'APPROVED') {
      return NextResponse.json(
        { error: `Cannot mark as PAID. Payroll record is in ${payroll.status} state, must be APPROVED.` },
        { status: 403 }
      );
    }

    // Update state to PAID
    const updatedPayroll = await (prisma.payrollRecord as any).update({
      where: { id: payrollRecordId },
      data: {
        status: 'PAID',
        transactionReference,
        paidAt: new Date(),
        paymentDate: new Date()
      }
    });

    return NextResponse.json({ success: true, data: updatedPayroll });
  } catch (error: any) {
    console.error('Error in /api/payroll/pay:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
