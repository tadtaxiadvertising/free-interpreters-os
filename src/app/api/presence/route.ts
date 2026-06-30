import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';
import { PresenceSchema } from '@/lib/api-schemas';
import { apiError, parseJsonBody } from '@/lib/api-responses';

const db = prisma;

export async function POST(req: Request) {
  try {
    const userData = await getCurrentUser();

    if (!userData) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await parseJsonBody(req, PresenceSchema);

    const profile = userData.profile;

    if (!profile?.interpreterId) {
      return NextResponse.json({ success: false, error: 'Interpreter not found' }, { status: 404 });
    }

    // Single update. If no status provided, we just update the ID to itself
    // which triggers the @updatedAt field in Prisma.
    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: {
        ...(status ? { realtimeStatus: status } : { id: profile.interpreterId })
      },
      select: { id: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError({ error, fallback: 'Internal Server Error' });
  }
}

