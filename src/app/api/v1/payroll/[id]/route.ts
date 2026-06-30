import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PayrollRecordPatchSchema } from '@/lib/api-schemas';
import { apiError, parseJsonBody, stringIdParamSchema } from '@/lib/api-responses';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = stringIdParamSchema.parse(await params);

    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: { interpreter: true }
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Payroll record not found' }, { status: 404 });
    }

    return NextResponse.json(record, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error fetching payroll record:', error);
    return apiError({ error, fallback: 'Error fetching payroll record' });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = stringIdParamSchema.parse(await params);

    const body = await parseJsonBody(request, PayrollRecordPatchSchema);

    const updatedRecord = await prisma.payrollRecord.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updatedRecord, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error updating payroll record:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Payroll record not found' }, { status: 404 });
    }
    return apiError({ error, fallback: 'Error updating payroll record' });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = stringIdParamSchema.parse(await params);

    await prisma.payrollRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Payroll record deleted successfully' }, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error deleting payroll record:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ success: false, error: 'Payroll record not found' }, { status: 404 });
    }
    return apiError({ error, fallback: 'Error deleting payroll record' });
  }
}
