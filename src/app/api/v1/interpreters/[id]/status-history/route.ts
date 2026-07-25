import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

/**
 * GET /api/v1/interpreters/[id]/status-history
 * 
 * Returns the status change log for a specific interpreter.
 * Used by StatusTimeline component.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const interpreterId = parseInt(id, 10);
    if (isNaN(interpreterId)) {
      return NextResponse.json({ success: false, error: 'Invalid interpreter ID' }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

    // Verify interpreter exists
    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { id: true, name: true, realtimeStatus: true },
    });

    if (!interpreter) {
      return NextResponse.json({ success: false, error: 'Interpreter not found' }, { status: 404 });
    }

    const logs = await db.interpreterStatusLog.findMany({
      where: { interpreterId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        previousStatus: true,
        newStatus: true,
        reason: true,
        changedBy: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      interpreter: {
        id: interpreter.id,
        name: interpreter.name,
        currentStatus: interpreter.realtimeStatus,
      },
      logs,
    });
  } catch (error) {
    console.error('[StatusHistory] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}