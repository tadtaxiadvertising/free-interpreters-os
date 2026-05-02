'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { ActionResult } from '@/lib/types';

const db = prisma as any;

/**
 * ACTION: Update a system configuration key
 */
export async function updateSystemConfig(key: string, value: string): Promise<ActionResult> {
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
  } catch (error: any) {
    console.error(`Error updating system config ${key}:`, error.message);
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
