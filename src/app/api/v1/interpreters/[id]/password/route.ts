import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { password } = await request.json();
    const interpreterId = parseInt(id);

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // 1. Find the interpreter and user profile
    const interpreter = await prisma.interpreter.findUnique({
      where: { id: interpreterId },
      include: { userProfile: true }
    });

    if (!interpreter || !interpreter.userProfile) {
      return NextResponse.json({ error: 'Interpreter or user profile not found' }, { status: 404 });
    }

    // 2. Update Supabase Auth user
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      interpreter.userProfile.id,
      { password: password }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password updated successfully' });

  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: error.message || 'Error resetting password' }, { status: 500 });
  }
}
