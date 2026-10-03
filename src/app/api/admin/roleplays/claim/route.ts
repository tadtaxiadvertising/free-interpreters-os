import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    // Atomic claim - only claim if SUBMITTED and no evaluator assigned
    const session = await db.roleplaySession.update({
      where: {
        id: sessionId,
        status: 'SUBMITTED',
        evaluatorId: null,
      },
      data: {
        status: 'UNDER_REVIEW',
        evaluatorId: auth.user.userId,
        reviewStartedAt: new Date(),
      },
      select: { 
        id: true, 
        status: true, 
        evaluatorId: true,
        reviewStartedAt: true,
      },
    });

    if (!session) {
      // Check if session exists but wasn't claimable
      const existing = await db.roleplaySession.findUnique({
        where: { id: sessionId },
        select: { status: true, evaluatorId: true },
      });
      
      if (!existing) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }
      
      if (existing.status !== 'SUBMITTED') {
        return NextResponse.json({ success: false, error: 'Session is not in SUBMITTED state' }, { status: 400 });
      }
      
      if (existing.evaluatorId) {
        return NextResponse.json({ success: false, error: 'Session already claimed by another evaluator' }, { status: 409 });
      }
      
      return NextResponse.json({ success: false, error: 'Could not claim session' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        sessionId: session.id,
        status: session.status,
        evaluatorId: session.evaluatorId,
        reviewStartedAt: session.reviewStartedAt,
      } 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Claim Evaluation Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}