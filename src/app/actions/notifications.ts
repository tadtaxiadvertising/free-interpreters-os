'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  // Allow system or admin to create notifications
  const auth = await validateAction(['admin', 'interpreter']);
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const notification = await db.notification.create({
      data: {
        userId: input.userId as any, // Cast to any because of UUID/String mapping if needed
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: input.link
      }
    });

    revalidatePath('/'); 
    return { success: true, data: notification };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function markNotificationAsRead(id: string) {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    await db.notification.update({
      where: { id },
      data: { isRead: true }
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to update notification:', error);
    return { success: false, error: 'Failed to update notification' };
  }
}

