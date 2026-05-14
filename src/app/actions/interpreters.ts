'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { InterpreterSchema, InterpreterInput } from '@/lib/validators';
import { ActionResult } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { Interpreter, Prisma } from '@prisma/client';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

/**
 * ACTION: Create Interpreter
 */
export async function createInterpreter(data: InterpreterInput): Promise<ActionResult<Interpreter>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = InterpreterSchema.parse(data);
    const { password, ...interpreterData } = validated;

    const result = await db.$transaction(async (tx) => {
      // 1. Create interpreter record
      const interpreter = await tx.interpreter.create({
        data: interpreterData,
      });

      // 2. If password provided, create Auth user and UserProfile
      if (password) {
        if (!interpreterData.emailCorporativo) {
          throw new Error('Email corporativo is required for account creation');
        }

        const supabaseAdmin = createAdminClient();
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: interpreterData.emailCorporativo,
          password: password,
          email_confirm: true,
          user_metadata: { display_name: interpreterData.name }
        });

        if (authError) throw authError;

        if (authUser.user) {
          await tx.userProfile.upsert({
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

      return interpreter;
    });

    revalidatePath('/interpreters');
    revalidatePath('/admin');
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('Error in createInterpreter action:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const meta = error.meta as Record<string, unknown> | undefined;
      const target = Array.isArray(meta?.target) ? meta?.target[0] : 'field';
      return { 
        success: false, 
        error: `An interpreter with this ${target} already exists.`,
        code: 'CONFLICT'
      };
    }

    const errorMsg = error instanceof Error ? error.message : 'Failed to create interpreter';
    return { success: false, error: errorMsg, code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Update Interpreter
 */
export async function updateInterpreter(id: number, data: Partial<InterpreterInput>): Promise<ActionResult<{ id: number; name: string }>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = InterpreterSchema.partial().parse(data);

    const interpreter = await db.interpreter.update({
      where: { id },
      data: validated,
      select: { id: true, name: true }
    });

    revalidatePath('/interpreters');
    revalidatePath(`/interpreters/${id}`);
    return { success: true, data: interpreter };
  } catch (error: unknown) {
    console.error('Error in updateInterpreter action:', error);
    return { success: false, error: 'Failed to update interpreter', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Delete Interpreter (with Auth User)
 */
export async function deleteInterpreter(id: number): Promise<ActionResult> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    await db.$transaction(async (tx) => {
      // 1. Get interpreter and profile
      const interpreter = await tx.interpreter.findUnique({
        where: { id },
        include: { userProfile: { select: { id: true } } }
      });

      if (!interpreter) throw new Error('Interpreter not found');

      // 2. Delete Supabase Auth user if linked
      if (interpreter.userProfile) {
        const supabaseAdmin = createAdminClient();
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(interpreter.userProfile.id);
        if (authError) console.warn('Failed to delete auth user:', authError.message);
        
        await tx.userProfile.delete({ where: { id: interpreter.userProfile.id } });
      }

      // 3. Delete interpreter
      await tx.interpreter.delete({ where: { id } });
    });

    revalidatePath('/interpreters');
    revalidatePath('/admin');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error in deleteInterpreter action:', error);
    return { success: false, error: 'Failed to delete interpreter', code: 'INTERNAL_ERROR' };
  }
}

export async function resetInterpreterPassword(id: number, password: string): Promise<ActionResult> {
  try {
    const interpreter = await db.interpreter.findUnique({
      where: { id },
      include: { userProfile: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    let userProfileId = interpreter.userProfile?.id;

    // If no userProfile exists, attempt to create a linked account
    if (!userProfileId) {
      if (!interpreter.emailCorporativo) {
        return { 
          success: false, 
          error: 'No access account linked to this Interpreter and no corporate email is configured to create one.',
          code: 'VALIDATION_ERROR'
        };
      }

      const supabaseAdmin = createAdminClient();
      
      // 1. Check if Auth user already exists but isn't linked
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      let authUser = existingUsers.users.find(u => u.email === interpreter.emailCorporativo);

      if (!authUser) {
        // 2. Create new Auth user
        const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: interpreter.emailCorporativo,
          password: password,
          email_confirm: true,
          user_metadata: { display_name: interpreter.name }
        });

        if (authError) throw authError;
        authUser = newUser.user;
      } else {
        // 3. Update existing Auth user password
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          { password }
        );
        if (updateError) throw updateError;
      }

      if (authUser) {
        // 4. Link UserProfile via Prisma
        const profile = await db.userProfile.upsert({
          where: { id: authUser.id },
          update: {
            email: interpreter.emailCorporativo,
            displayName: interpreter.name,
            interpreterId: interpreter.id,
            onboardingComplete: true
          },
          create: {
            id: authUser.id,
            email: interpreter.emailCorporativo,
            displayName: interpreter.name,
            role: 'interpreter',
            interpreterId: interpreter.id,
            onboardingComplete: true
          }
        });
        userProfileId = profile.id;
      }
    } else {
      // Normal flow: Account exists, just update password
      const supabaseAdmin = createAdminClient();
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        userProfileId,
        { password }
      );

      if (authError) throw authError;
    }

    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error resetting password:', errorMsg);
    return { success: false, error: errorMsg, code: 'INTERNAL_ERROR' };
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
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating realtime status:', errorMsg);
    return { success: false, error: 'Failed to update status' };
  }
}

