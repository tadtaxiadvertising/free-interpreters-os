import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { QAScoreSchema } from '@/lib/validators';

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const interpreterId = searchParams.get('interpreterId');
    const auditor = searchParams.get('auditor');

    const whereClause: Record<string, unknown> = {};
    if (interpreterId) {
      whereClause.interpreterId = parseInt(interpreterId, 10);
    }
    if (auditor) {
      whereClause.auditor = { contains: auditor, mode: 'insensitive' };
    }

    const scores = await prisma.qAScore.findMany({
      where: whereClause,
      include: {
        interpreter: {
          select: { name: true, externalId: true }
        }
      },
      orderBy: { auditDate: 'desc' },
    });

    return NextResponse.json(scores, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error fetching QA scores:', error);
    const message = error instanceof Error ? error.message : 'Error fetching QA scores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = QAScoreSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    // Calculate total score if not provided
    const data = validationResult.data;
    if (!data.totalScore) {
      const sum = (data.protocolScore || 0) + 
                  (data.interpretationScore || 0) + 
                  (data.languageScore || 0) + 
                  (data.serviceScore || 0) + 
                  (data.technicalScore || 0);
      data.totalScore = sum;
    }

    const newScore = await prisma.qAScore.create({
      data: data,
    });

    return NextResponse.json(newScore, { 
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error creating QA score:', error);
    const message = error instanceof Error ? error.message : 'Error creating QA score';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
