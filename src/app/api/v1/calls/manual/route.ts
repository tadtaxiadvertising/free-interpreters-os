import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/actions';
import prismaClient from '@/lib/prisma';
const prisma = prismaClient;

export async function POST(req: Request) {
  try {
    const userData = await getCurrentUser();
    if (!userData || !userData.profile || !userData.profile.interpreterId) {
      return NextResponse.json({ error: 'Unauthorized or no interpreter profile' }, { status: 401 });
    }

    const interpreter = await prisma.interpreter.findUnique({
      where: { id: userData.profile.interpreterId }
    });

    if (!interpreter) {
      return NextResponse.json({ error: 'Interpreter profile not found' }, { status: 404 });
    }

    const { durationMinutes, seconds = 0 } = await req.json();
    if ((!durationMinutes && durationMinutes !== 0) || isNaN(Number(durationMinutes))) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const totalSeconds = (Number(durationMinutes) * 60) + Number(seconds);
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

    return NextResponse.json(callSession);
  } catch (error) {
    console.error('Error creating manual call log:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
