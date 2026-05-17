'use server';

import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { validateAction } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

const db = prisma;

export async function updatePayrate(
  interpreterId: number,
  newRate: number
): Promise<ActionResult<{ oldRate: number; newRate: number }>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {

    if (newRate <= 0 || newRate > 999.99) {
      return { success: false, error: 'Rate must be between $0.01 and $999.99', code: 'VALIDATION_ERROR' };
    }

    // 2. Get current rate via Prisma
    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { tariffPerMinute: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    const oldRate = Number(interpreter.tariffPerMinute);

    // 3. Update rate via Prisma
    await db.interpreter.update({
      where: { id: interpreterId },
      data: { tariffPerMinute: newRate },
      select: { id: true }
    });

    // 4. Write audit log via Prisma
    await db.payrateAuditLog.create({
      data: {
        interpreterId: interpreterId,
        oldRate: oldRate,
        newRate: newRate,
        changedBy: auth.user.id,
      },
      select: { id: true }
    });

    revalidatePath('/admin');
    revalidatePath('/admin/payrates');
    revalidatePath('/payroll');
    return { success: true, data: { oldRate, newRate } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating payrate:', message);
    return { success: false, error: message, code: 'SERVICE_UNAVAILABLE' };
  }
}

export async function getPayrateHistory(
  interpreterId: number
): Promise<ActionResult<unknown[]>> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const history = await db.payrateAuditLog.findMany({
      where: { interpreterId: interpreterId },
      orderBy: { changedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        oldRate: true,
        newRate: true,
        changedAt: true,
        changedBy: true
      }
    });

    return { success: true, data: history ?? [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message, code: 'SERVICE_UNAVAILABLE' };
  }
}

