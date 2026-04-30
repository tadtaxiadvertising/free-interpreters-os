'use server';

import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import type { ActionResult, PayrateAuditEntry } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const db = prisma as any;

export async function updatePayrate(
  interpreterId: number,
  newRate: number
): Promise<ActionResult<{ oldRate: number; newRate: number }>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // Verify admin role
    const profile = await db.userProfile.findFirst({
      where: { 
        OR: [
          { id: userId },
          { clerkId: userId }
        ]
      },
      select: { role: true }
    });

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
    }

    if (newRate <= 0 || newRate > 999.99) {
      return { success: false, error: 'Rate must be between $0.01 and $999.99', code: 'VALIDATION_ERROR' };
    }

    // Get current rate
    const interpreter = await db.interpreter.findUnique({
      where: { id: interpreterId },
      select: { tariffPerMinute: true }
    });

    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    const oldRate = Number(interpreter.tariffPerMinute);

    // Update rate
    await db.interpreter.update({
      where: { id: interpreterId },
      data: { tariffPerMinute: newRate }
    });

    // Write audit log
    await db.payrateAuditLog.create({
      data: {
        interpreterId: interpreterId,
        oldRate: oldRate,
        newRate: newRate,
        changedBy: userId,
      }
    });

    revalidatePath('/admin');
    revalidatePath('/payroll');
    return { success: true, data: { oldRate, newRate } };
  } catch (error: any) {
    console.error('Error updating payrate:', error);
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}

export async function getPayrateHistory(
  interpreterId: number
): Promise<ActionResult<PayrateAuditEntry[]>> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const history = await db.payrateAuditLog.findMany({
      where: { interpreterId },
      orderBy: { changedAt: 'desc' },
      take: 20
    });

    return { success: true, data: history ?? [] };
  } catch (error: any) {
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}
