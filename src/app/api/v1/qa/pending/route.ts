import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // In a real scenario, this would filter calls that haven't been audited
    // For now, we fetch the most recent completed calls
    const pendingCalls = await prisma.callSession.findMany({
      where: {
        endedAt: { not: null },
      },
      include: { 
        interpreter: {
          select: { name: true, campaign: true }
        } 
      },
      orderBy: { startedAt: 'desc' },
      take: 5
    });

    return NextResponse.json(pendingCalls, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error fetching pending audits:', error);
    const message = error instanceof Error ? error.message : 'Error fetching pending audits';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
