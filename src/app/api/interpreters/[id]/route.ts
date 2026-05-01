import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interpreterId = parseInt(id);

    if (isNaN(interpreterId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // 1. Get interpreter to find associated UserProfile/Auth
    const interpreter = await prisma.interpreter.findUnique({
      where: { id: interpreterId },
      include: { userProfile: true }
    });

    if (!interpreter) {
      return NextResponse.json({ error: 'Interpreter not found' }, { status: 404 });
    }

    // 2. Delete Auth user if exists
    if (interpreter.userProfile) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.deleteUser(interpreter.userProfile.id);
      
      // UserProfile will be deleted automatically if RLS/Prisma CASCADE is set, 
      // but let's be explicit if needed. Prisma usually needs manual delete if not set in schema.
      await prisma.userProfile.delete({ where: { id: interpreter.userProfile.id } });
    }

    // 3. Delete interpreter (CASCADE should handle related records in production_logs, etc.)
    await prisma.interpreter.delete({
      where: { id: interpreterId },
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting interpreter:', error);
    return NextResponse.json({ error: error.message || 'Error deleting interpreter' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const interpreterId = parseInt(id);

    const updated = await prisma.interpreter.update({
      where: { id: interpreterId },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
