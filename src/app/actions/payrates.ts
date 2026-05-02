'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const db = prisma as any;

export async function updatePayrate(
  interpreterId: number,
  newRate: number
): Promise<ActionResult<{ oldRate: number; newRate: number }>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    // 1. Verify admin role using user_profiles table via Prisma
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: { role: true }
    });

    if (profile?.role !== 'admin') {
      return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
    }

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
      data: { tariffPerMinute: newRate }
    });

    // 4. Write audit log via Prisma
    await db.payrateAuditLog.create({
      data: {
        interpreterId: interpreterId,
        oldRate: oldRate,
        newRate: newRate,
        changedBy: user.id,
      }
    });

    revalidatePath('/admin');
    revalidatePath('/admin/payrates');
    revalidatePath('/payroll');
    return { success: true, data: { oldRate, newRate } };
  } catch (error: any) {
    console.error('Error updating payrate:', error.message);
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}

export async function getPayrateHistory(
  interpreterId: number
): Promise<ActionResult<any[]>> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  try {
    const history = await db.payrateAuditLog.findMany({
      where: { interpreterId: interpreterId },
      orderBy: { changedAt: 'desc' },
      take: 20
    });

    return { success: true, data: history ?? [] };
  } catch (error: any) {
    return { success: false, error: error.message, code: 'SERVICE_UNAVAILABLE' };
  }
}

