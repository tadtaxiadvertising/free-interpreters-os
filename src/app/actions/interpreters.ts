'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { InterpreterSchema, InterpreterInput } from '@/lib/validators';
import { ActionResult } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';

const db = prisma as any;

/**
 * ACTION: Create Interpreter
 */
export async function createInterpreter(data: InterpreterInput): Promise<ActionResult<any>> {
  try {
    const validated = InterpreterSchema.parse(data);
    const { password, ...interpreterData } = validated;

    // 1. Create interpreter record
    const interpreter = await db.interpreter.create({
      data: interpreterData as any,
    });

    // 2. If password provided, create Auth user and UserProfile
    if (password) {
      if (!interpreterData.emailCorporativo) {
        return { success: false, error: 'Email corporativo is required for account creation' };
      }

      const supabaseAdmin = createAdminClient();
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: interpreterData.emailCorporativo,
        password: password,
        email_confirm: true,
        user_metadata: { display_name: interpreterData.name }
      });

      if (authError) {
        console.error('Auth creation failed:', authError.message);
        return { 
          success: false, 
          error: `Interpreter created, but account setup failed: ${authError.message}` 
        };
      }

      if (authUser.user) {
        await db.userProfile.upsert({
          where: { id: authUser.user.id },
          update: {
            email: interpreterData.emailCorporativo,
            displayName: interpreterData.name,
            interpreterId: interpreter.id
          },
          create: {
            id: authUser.user.id,
            email: interpreterData.emailCorporativo,
            displayName: interpreterData.name,
            role: 'interpreter',
            interpreterId: interpreter.id
          }
        });
      }
    }

    revalidatePath('/interpreters');
    revalidatePath('/admin');
    return { success: true, data: interpreter };
  } catch (error: any) {
    console.error('Error in createInterpreter action:', error);
    if (error.code === 'P2002') {
      return { 
        success: false, 
        error: `An interpreter with this ${error.meta?.target?.[0]} already exists.`,
        code: 'CONFLICT'
      };
    }
    return { 
      success: false, 
      error: error.message || 'Failed to create interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}


/**
 * ACTION: Update Interpreter
 */
export async function updateInterpreter(id: number, data: Partial<InterpreterInput>): Promise<ActionResult<any>> {
  try {
    const validated = InterpreterSchema.partial().parse(data);

    const interpreter = await db.interpreter.update({
      where: { id },
      data: validated,
    });

    revalidatePath('/interpreters');
    revalidatePath(`/interpreters/${id}`);
    return { success: true, data: interpreter };
  } catch (error: any) {
    console.error('Error in updateInterpreter action:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Delete Interpreter (with Auth User)
 */
export async function deleteInterpreter(id: number): Promise<ActionResult> {
  try {
    // 1. Get interpreter and profile via Prisma
    const interpreter = await db.interpreter.findUnique({
      where: { id },
      include: { userProfile: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    // 2. Delete Supabase Auth user if linked
    if (interpreter.userProfile) {
      const supabaseAdmin = createAdminClient();
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(interpreter.userProfile.id);
      if (authError) {
        console.warn('Failed to delete auth user:', authError.message);
      }
      
      // Delete user profile via Prisma
      await db.userProfile.delete({ where: { id: interpreter.userProfile.id } });
    }

    // 3. Delete interpreter via Prisma
    await db.interpreter.delete({
      where: { id },
    });

    revalidatePath('/interpreters');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteInterpreter action:', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to delete interpreter',
      code: 'INTERNAL_ERROR'
    };
  }
}

/**
 * ACTION: Reset Interpreter Password
 */
export async function resetInterpreterPassword(id: number, password: string): Promise<ActionResult> {
  try {
    const interpreter = await db.interpreter.findUnique({
      where: { id },
      include: { userProfile: true }
    });

    if (!interpreter?.userProfile) {
      return { success: false, error: 'No access account linked to this interpreter', code: 'NOT_FOUND' };
    }

    const supabaseAdmin = createAdminClient();
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      interpreter.userProfile.id,
      { password }
    );

    if (authError) throw authError;

    return { success: true };
  } catch (error: any) {
    console.error('Error resetting password:', error.message);
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Toggle Realtime Status
 */
export async function updateRealtimeStatus(id: number, status: 'Online' | 'Offline' | 'Busy'): Promise<ActionResult> {
  try {
    await db.interpreter.update({
      where: { id },
      data: { realtimeStatus: status },
    });

    revalidatePath('/interpreters');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating realtime status:', error.message);
    return { success: false, error: 'Failed to update status' };
  }
}

