'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const db = prisma;

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  try {
    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: input.link
      }
    });

    revalidatePath('/'); // Global revalidation for the bell icon
    return { success: true, data: notification };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Failed to create notification:', message);
    return { success: false, error: message };
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    await db.notification.update({
      where: { id },
      data: { isRead: true }
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update notification';
    console.error('Failed to update notification:', message);
    return { success: false, error: message };
  }
}

