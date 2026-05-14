'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { ActionResult } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

const db = prisma;

/**
 * ACTION: Update a system configuration key
 */
export async function updateSystemConfig(key: string, value: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  // Verify admin role via Prisma
  const profile = await db.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });
  if (profile?.role !== 'admin') {
    return { success: false, error: 'Admin access required', code: 'UNAUTHORIZED' };
  }

  if (!key || typeof key !== 'string' || key.length > 100) {
    return { success: false, error: 'Invalid config key', code: 'VALIDATION_ERROR' };
  }

  try {
    await db.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/ranking');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error updating system config ${key}:`, message);
    return { success: false, error: 'Failed to update configuration' };
  }
}

/**
 * ACTION: Get a system configuration value
 */
export async function getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const config = await db.systemConfig.findUnique({
      where: { key }
    });
    return config ? config.value : defaultValue;
  } catch (error) {
    console.error(`Error fetching system config ${key}:`, error);
    return defaultValue;
  }
}
