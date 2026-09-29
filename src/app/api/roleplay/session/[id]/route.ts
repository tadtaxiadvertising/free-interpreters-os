import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const db = prisma;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const session = await db.roleplaySession.findUnique({
      where: { id },
      select: {
        id: true,
        baseAudioUrl: true,
        recordedAudioUrl: true,
        status: true,
        interpreterId: true,
        recruitmentCandidateId: true,
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get Session Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}