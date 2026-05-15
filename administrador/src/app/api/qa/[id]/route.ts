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
    
    // Partial validation
    const validationResult = QAScoreSchema.partial().safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const updatedScore = await prisma.qAScore.update({
      where: { id },
      data: validationResult.data,
    });

    return NextResponse.json(updatedScore, {
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
    });
  } catch (error) {
    console.error('Error updating scorecard:', error);
    const isPrismaError = error && typeof error === 'object' && 'code' in error;
    if (isPrismaError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Scorecard not found' }, { status: 404 });
    }
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
