import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';
import { ManualCallSchema } from '@/lib/api-schemas';
import { apiError, parseJsonBody } from '@/lib/api-responses';

export async function POST(req: Request) {
  try {
    const userData = await getCurrentUser();
    if (!userData || !userData.profile || !userData.profile.interpreterId) {
      return NextResponse.json({ success: false, error: 'Unauthorized or no interpreter profile' }, { status: 401 });
    }

    const interpreter = await prisma.interpreter.findUnique({
      where: { id: userData.profile.interpreterId }
    });

    if (!interpreter) {
      return NextResponse.json({ success: false, error: 'Interpreter profile not found' }, { status: 404 });
    }

    const { durationMinutes, seconds } = await parseJsonBody(req, ManualCallSchema);
    const totalSeconds = Math.round((durationMinutes * 60) + seconds);
    const tariffSnapshot = Number(interpreter.tariffPerMinute);
    const callCost = (totalSeconds / 60) * tariffSnapshot;

    // Create call session
    const callSession = await prisma.callSession.create({
      data: {
        interpreterId: interpreter.id,
        startedAt: new Date(Date.now() - totalSeconds * 1000), // Approximate start time
        endedAt: new Date(),
        durationSeconds: totalSeconds,
        tariffSnapshot: tariffSnapshot,
        callCost: callCost,
        notes: 'Manual entry via Quick Log'
      }
    });

    return NextResponse.json({ success: true, data: callSession });
  } catch (error) {
    console.error('Error creating manual call log:', error);
    return apiError({ error, fallback: 'Internal Server Error' });
  }
}
