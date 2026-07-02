import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { InterpreterPasswordSchema } from '@/lib/api-schemas';
import { apiError, numericIdParamSchema, parseJsonBody } from '@/lib/api-responses';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interpreterId } = numericIdParamSchema.parse(await params);
    const { password } = await parseJsonBody(request, InterpreterPasswordSchema);

    // 1. Find the interpreter and user profile
    const interpreter = await prisma.interpreter.findUnique({
      where: { id: interpreterId },
      include: { userProfile: true }
    });

    if (!interpreter || !interpreter.userProfile) {
      return NextResponse.json({ success: false, error: 'Interpreter or user profile not found' }, { status: 404 });
    }

    // 2. Update Supabase Auth user
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      interpreter.userProfile.id,
      { password, email_confirm: true }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Password updated successfully' });

  } catch (error) {
    console.error('Error resetting password:', error);
    return apiError({ error, fallback: 'Error resetting password' });
  }
}
