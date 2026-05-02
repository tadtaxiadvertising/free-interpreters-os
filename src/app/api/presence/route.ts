import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

const db = prisma as any;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get interpreter data
    const { status, type } = await req.json();
    
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }
    
    const updateData: any = { lastActive: new Date() };
    if (status) {
      updateData.realtimeStatus = status;
    }

    await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: updateData
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Presence API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
