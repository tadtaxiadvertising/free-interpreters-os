import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

const db = prisma;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    let user = null;
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      user = currentUser;
    } catch (e) {
      // Ignore
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Parse body first
    const { status } = await req.json();

    // 2. Get interpreter ID
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }

    // 3. Update status
    // For explicit status changes (Online/Offline/Busy), set the provided status.
    // For heartbeat pulses (no status), touch updatedAt by re-writing the current status.
    const updateData: any = {};
    if (status) {
      updateData.realtimeStatus = status;
    } else {
      // Heartbeat: read current status and write it back to bump updatedAt
      const current = await db.interpreter.findUnique({
        where: { id: profile.interpreterId },
        select: { realtimeStatus: true }
      });
      updateData.realtimeStatus = current?.realtimeStatus ?? 'Online';
    }

    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: updateData,
      select: { id: true }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Presence API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
