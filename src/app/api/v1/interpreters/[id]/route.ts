import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';

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

    revalidateInterpreterProfileRecords(interpreterId);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting interpreter:', error);
    const message = error instanceof Error ? error.message : 'Error deleting interpreter';
    return NextResponse.json({ error: message }, { status: 500 });
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
    
    const { password, ...updateData } = body;

    // 1. If password provided, update Supabase Auth
    if (password) {
      const interpreter = await prisma.interpreter.findUnique({
        where: { id: interpreterId },
        include: { userProfile: true }
      });

      if (interpreter?.userProfile) {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabaseAdmin = createAdminClient();
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          interpreter.userProfile.id,
          { password }
        );
        if (authError) throw authError;
      }
    }

    // 2. Update Interpreter record
    const updated = await prisma.interpreter.update({
      where: { id: interpreterId },
      data: updateData,
    });

    revalidateInterpreterProfileRecords(interpreterId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating interpreter:', error);
    const message = error instanceof Error ? error.message : 'Error updating interpreter';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
