'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  link?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  const supabase = await createClient();
  
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: input.link
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/'); // Global revalidation for the bell icon
    return { success: true, data: notification };
  } catch (error) {
    console.error('Failed to create notification:', error);
    return { success: false, error: 'Internal server error' };
  }
}

export async function markNotificationAsRead(id: string) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to update notification' };
  }
}
