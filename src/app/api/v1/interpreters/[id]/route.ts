import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { deleteInterpreterDatabaseRecords } from '@/lib/interpreters/delete-interpreter';
import { InterpreterPatchSchema } from '@/lib/api-schemas';
import { apiError, numericIdParamSchema, parseJsonBody } from '@/lib/api-responses';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interpreterId } = numericIdParamSchema.parse(await params);

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
    if (message === 'Intérprete no encontrado') {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return apiError({ error, fallback: 'Error deleting interpreter' });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interpreterId } = numericIdParamSchema.parse(await params);
    const body = await parseJsonBody(request, InterpreterPatchSchema);
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
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating interpreter:', error);
    return apiError({ error, fallback: 'Error updating interpreter' });
  }
}
