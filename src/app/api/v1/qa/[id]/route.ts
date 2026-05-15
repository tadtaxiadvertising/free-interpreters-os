import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { QAScoreSchema } from '@/lib/validators';

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
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const score = await prisma.qAScore.findUnique({
      where: { id },
      include: {
        interpreter: true,
        productionLog: true,
      }
    });

    if (!score) {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
    }

    return NextResponse.json(score, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error fetching scorecard:', error);
    const message = error instanceof Error ? error.message : 'Error fetching scorecard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    
    // Rule D: Partial validation
    const validationResult = QAScoreSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const existingScore = await prisma.qAScore.findUnique({ where: { id } });
    if (!existingScore) {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
    }

    const updateData = { ...validationResult.data };

    // FÓRMULA DE CALIDAD (QA Scorecard) - Re-calculate if components changed
    // Rule C: Safely cast Prisma Decimals to number
    const protocol = Number(updateData.protocolScore ?? existingScore.protocolScore ?? 0);
    const interpretation = Number(updateData.interpretationScore ?? existingScore.interpretationScore ?? 0);
    const language = Number(updateData.languageScore ?? existingScore.languageScore ?? 0);
    const service = Number(updateData.serviceScore ?? existingScore.serviceScore ?? 0);
    const technical = Number(updateData.technicalScore ?? existingScore.technicalScore ?? 0);

    let totalScore = (protocol * 0.20) + 
                     (interpretation * 0.40) + 
                     (language * 0.20) + 
                     (service * 0.10) + 
                     (technical * 0.10);


    // REGLA CRÍTICA DE AUTO-FAIL
    const isCritical = updateData.criticalError ?? existingScore.criticalError;
    if (isCritical === true) {
      totalScore = 0.00;
      updateData.accionRequerida = 'Advertencia';
    }

    updateData.totalScore = Math.round(totalScore * 100) / 100;

    const updatedScore = await prisma.qAScore.update({
      where: { id },
      data: updateData as any,
    });

    return NextResponse.json(updatedScore, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('🔴 QA PATCH ERROR:', error);
    const message = error instanceof Error ? error.message : 'Error updating scorecard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await prisma.qAScore.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Scorecard deleted successfully' }, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error deleting scorecard:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : 'Error deleting scorecard';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
