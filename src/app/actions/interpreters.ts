'use server';

import { revalidatePath } from 'next/cache';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import prisma from '@/lib/prisma';
import { InterpreterSchema, InterpreterInput } from '@/lib/validators';
import { ActionResult } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { Interpreter, Prisma } from '@prisma/client';
import { validateAction } from '@/lib/auth/actions';
import { UpdateInterpreterStatusSchema } from '@/lib/validators/interpreters';

const db = prisma;

/**
 * ACTION: Create Interpreter
 */
export async function createInterpreter(data: InterpreterInput): Promise<ActionResult<{ id: number; name: string }>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = InterpreterSchema.parse(data);
    const { password, ...interpreterData } = validated;

    const result = await db.$transaction(async (tx) => {
      // 1. Create interpreter record
      const interpreter = await tx.interpreter.create({
        data: interpreterData,
        select: { id: true, name: true, emailCorporativo: true }
      });

      // 2. If password provided, create Auth user and UserProfile
      if (password) {
        if (!interpreter.emailCorporativo) {
          throw new Error('Email corporativo is required for account creation');
        }

        const supabaseAdmin = createAdminClient();
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: interpreter.emailCorporativo,
          password: password,
          email_confirm: true,
          user_metadata: { display_name: interpreter.name }
        });

        if (authError) throw authError;

        if (authUser.user) {
          await tx.userProfile.upsert({
            where: { id: authUser.user.id },
            update: {
              email: interpreter.emailCorporativo,
              displayName: interpreter.name,
              interpreterId: interpreter.id,
              onboardingComplete: true
            },
            create: {
              id: authUser.user.id,
              email: interpreter.emailCorporativo,
              displayName: interpreter.name,
              role: 'interpreter',
              interpreterId: interpreter.id,
              onboardingComplete: true
            }
          });
        }
      }

      return { id: interpreter.id, name: interpreter.name };
    });

    revalidateInterpreterProfileRecords(result.id);
    return { success: true, data: result };
  } catch (error: unknown) {
    console.error('🔴 ERROR [createInterpreter]:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'Un intérprete con este ID externo o Email ya existe.', code: 'CONFLICT' };
    }

    const errorMsg = error instanceof Error ? error.message : 'Error al crear el intérprete';
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
    const { password, ...updateData } = validated;

    const interpreter = await db.interpreter.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true }
    });

    revalidateInterpreterProfileRecords(id);
    return { success: true, data: interpreter };
  } catch (error: unknown) {
    console.error('🔴 ERROR [updateInterpreter]:', error);
    return { success: false, error: 'Error al actualizar el intérprete', code: 'INTERNAL_ERROR' };
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
      // 1. Get interpreter and profile with minimal fields
      const interpreter = await tx.interpreter.findUnique({
        where: { id },
        select: { 
          id: true,
          userProfile: { select: { id: true } } 
        }
      });

      if (!interpreter) throw new Error('Intérprete no encontrado');

      // 2. Delete Supabase Auth user if linked
      if (interpreter.userProfile) {
        const supabaseAdmin = createAdminClient();
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(interpreter.userProfile.id);
        if (authError) console.warn('⚠️ Fallo al borrar usuario de Auth:', authError.message);
        
        await tx.userProfile.delete({ where: { id: interpreter.userProfile.id } });
      }

      // 3. Delete interpreter record
      await tx.interpreter.delete({ where: { id } });
    });

    revalidateInterpreterProfileRecords(id);
    return { success: true };
  } catch (error: unknown) {
    console.error('🔴 ERROR [deleteInterpreter]:', error);
    return { success: false, error: 'Error al eliminar el intérprete', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Reset/Set Interpreter Password
 */
export async function getInterpretersForSelect(): Promise<ActionResult<{ id: number; name: string; externalId: string }[]>> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const interpreters = await db.interpreter.findMany({
      select: {
        id: true,
        name: true,
        externalId: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, data: interpreters };
  } catch (error: unknown) {
    console.error('🔴 ERROR [getInterpretersForSelect]:', error);
    return { success: false, error: 'Error al obtener intérpretes', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Reset/Set Interpreter Password
 */
export async function resetInterpreterPassword(id: number, password: string): Promise<ActionResult> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const interpreter = await db.interpreter.findUnique({
      where: { id },
      select: { 
        id: true, 
        name: true, 
        emailCorporativo: true,
        userProfile: { select: { id: true } }
      }
    });

    if (!interpreter) return { success: false, error: 'Intérprete no encontrado', code: 'NOT_FOUND' };

    let userProfileId = interpreter.userProfile?.id;
    const supabaseAdmin = createAdminClient();

    if (!userProfileId) {
      if (!interpreter.emailCorporativo) {
        return { success: false, error: 'No hay cuenta vinculada ni email corporativo configurado.', code: 'VALIDATION_ERROR' };
      }

      // 1. Find or create Auth user
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      let authUser = existingUsers.users.find(u => u.email === interpreter.emailCorporativo);

      if (!authUser) {
        const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: interpreter.emailCorporativo,
          password: password,
          email_confirm: true,
          user_metadata: { display_name: interpreter.name }
        });
        if (authError) throw authError;
        authUser = newUser.user;
      } else {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password });
        if (updateError) throw updateError;
      }

      // 2. Link Profile
      if (authUser) {
        await db.userProfile.upsert({
          where: { id: authUser.id },
          update: { interpreterId: interpreter.id, onboardingComplete: true },
          create: {
            id: authUser.id,
            email: interpreter.emailCorporativo,
            displayName: interpreter.name,
            role: 'interpreter',
            interpreterId: interpreter.id,
            onboardingComplete: true
          }
        });
      }
    } else {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userProfileId, { password });
      if (authError) throw authError;
    }

    revalidateInterpreterProfileRecords(id);
    return { success: true };
  } catch (error: unknown) {
    console.error('🔴 ERROR [resetInterpreterPassword]:', error);
    return { success: false, error: 'Error al resetear contraseña', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Toggle Realtime Status
 */
export async function updateRealtimeStatus(id: number, status: 'Online' | 'Offline' | 'Busy'): Promise<ActionResult> {
  const auth = await validateAction(['admin', 'interpreter']);
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    // If user is interpreter, they can only update their own status
    if (auth.profile.role === 'interpreter' && auth.profile.interpreterId !== id) {
      return { success: false, error: 'Acceso denegado', code: 'UNAUTHORIZED' };
    }

    await db.interpreter.update({
      where: { id },
      data: { realtimeStatus: status },
      select: { id: true }
    });

    revalidateInterpreterProfileRecords(id);
    return { success: true };
  } catch (error: unknown) {
    console.error('🔴 ERROR [updateRealtimeStatus]:', error);
    return { success: false, error: 'Error al actualizar estado en tiempo real', code: 'INTERNAL_ERROR' };
  }
}




export async function updateInterpreterStatusAction(data: unknown): Promise<{ success: boolean; data?: { id: number; status: string }; error?: string }> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error };

  try {
    const parsedData = UpdateInterpreterStatusSchema.strict().parse(data);

    const updatedInterpreter = await db.interpreter.update({
      where: { id: parsedData.id },
      data: { status: parsedData.status },
      select: { id: true, status: true },
    });

    revalidatePath('/admin/roster');
    revalidateInterpreterProfileRecords(parsedData.id);

    const normalizedInterpreter = {
      id: updatedInterpreter.id,
      status: updatedInterpreter.status ?? 'Activo',
    };

    return {
      success: true,
      data: normalizedInterpreter,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el estado del intérprete';
    return { success: false, error: message };
  }
}
