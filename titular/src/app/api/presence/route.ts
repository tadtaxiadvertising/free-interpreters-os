import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

const db = prisma;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();

    // Combined update: find profile and update interpreter in one go if possible, 
    // or just minimize the chain.
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
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
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

