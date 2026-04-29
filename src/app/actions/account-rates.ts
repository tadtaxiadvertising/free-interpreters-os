'use server';

import prisma from '@/lib/prisma';
const db = prisma as any;
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export async function createAccount(name: string, description?: string): Promise<ActionResult<any>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const account = await db.account.create({
      data: { name, description }
    });
    revalidatePath('/admin/payrates');
    revalidatePath('/settings');
    return { success: true, data: account };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: 'La cuenta ya existe', code: 'CONFLICT' };
    }
    return { success: false, error: 'Error al crear la cuenta', code: 'INTERNAL_ERROR' };
  }
}

export async function updateAccount(id: number, name: string, description?: string): Promise<ActionResult<any>> {
  try {
    const account = await db.account.update({
      where: { id },
      data: { name, description }
    });
    revalidatePath('/admin/payrates');
    revalidatePath('/settings');
    return { success: true, data: account };
  } catch (error) {
    return { success: false, error: 'Error al actualizar la cuenta', code: 'INTERNAL_ERROR' };
  }
}

export async function deleteAccount(id: number): Promise<ActionResult<any>> {
  try {
    await db.account.delete({
      where: { id }
    });
    revalidatePath('/admin/payrates');
    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al eliminar la cuenta (puede tener registros asociados)', code: 'INTERNAL_ERROR' };
  }
}

export async function getAccounts() {
  return await db.account.findMany({
    orderBy: { name: 'asc' }
  });
}

export async function setInterpreterAccountRate(
  interpreterId: number,
  accountId: number,
  tariffPerHour: number
): Promise<ActionResult<any>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // Get old rate for audit
    const oldRate = await db.interpreterAccountRate.findUnique({
      where: {
        interpreterId_accountId: { interpreterId, accountId }
      }
    });

    const rate = await db.interpreterAccountRate.upsert({
      where: {
        interpreterId_accountId: {
          interpreterId,
          accountId,
        },
      },
      update: {
        tariffPerHour: tariffPerHour,
      },
      create: {
        interpreterId,
        accountId,
        tariffPerHour: tariffPerHour,
      },
    });

    // Create Audit Log
    await db.payrateAuditLog.create({
      data: {
        interpreterId,
        oldRate: oldRate?.tariffPerHour,
        newRate: tariffPerHour,
        changedBy: user.id
      }
    });

    revalidatePath('/admin/payrates');
    return { success: true, data: rate };
  } catch (error) {
    console.error('Error setting account rate:', error);
    return { success: false, error: 'Error setting account rate', code: 'INTERNAL_ERROR' };
  }
}

export async function deleteInterpreterAccountRate(
  interpreterId: number,
  accountId: number
): Promise<ActionResult<any>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    await db.interpreterAccountRate.delete({
      where: {
        interpreterId_accountId: {
          interpreterId,
          accountId,
        },
      },
    });

    revalidatePath('/admin/payrates');
    return { success: true };
  } catch (error) {
    console.error('Error deleting account rate:', error);
    return { success: false, error: 'Error deleting account rate', code: 'INTERNAL_ERROR' };
  }
}
