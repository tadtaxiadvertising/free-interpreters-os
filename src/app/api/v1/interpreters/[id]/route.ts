import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { deleteInterpreterDatabaseRecords } from '@/lib/interpreters/delete-interpreter';

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

    const { authUserId } = await prisma.$transaction((tx: any) => deleteInterpreterDatabaseRecords(tx, interpreterId));

    if (authUserId) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabaseAdmin = createAdminClient();
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (authError) console.warn('⚠️ Fallo al borrar usuario de Auth:', authError.message);
    }

    revalidateInterpreterProfileRecords(interpreterId);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting interpreter:', error);
    const message = error instanceof Error ? error.message : 'Error deleting interpreter';
    const status = message === 'Intérprete no encontrado' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
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

    // 2. Update Interpreter record and keep the linked user profile in sync
    const updated = await prisma.interpreter.update({
      where: { id: interpreterId },
      data: updateData,
    });

    await prisma.userProfile.updateMany({
      where: { interpreterId },
      data: {
        displayName: updated.name,
        ...(updated.emailCorporativo ? { email: updated.emailCorporativo } : {}),
      },
    });

    revalidateInterpreterProfileRecords(interpreterId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating interpreter:', error);
    const message = error instanceof Error ? error.message : 'Error updating interpreter';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
