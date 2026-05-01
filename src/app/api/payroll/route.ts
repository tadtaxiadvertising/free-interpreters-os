import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const interpreterId = searchParams.get('interpreterId');

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (interpreterId) {
      whereClause.interpreterId = parseInt(interpreterId, 10);
    }

    const records = await prisma.payrollRecord.findMany({
      where: whereClause,
      include: {
        interpreter: {
          select: { name: true, externalId: true, metodoPago: true }
        }
      },
      orderBy: { periodStart: 'desc' },
    });

    return NextResponse.json(records, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error: any) {
    console.error('Error fetching payroll records:', error);
    return NextResponse.json({ error: error.message || 'Error fetching payroll records' }, { status: 500 });
  }
}
