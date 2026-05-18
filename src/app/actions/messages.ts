'use server';

import { auth } from '@/lib/auth';
import prismaClient from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const prisma = prismaClient as any;

/**
 * Validates that a user session exists and returns the userId
 */
async function getAuthenticatedUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('No autorizado');
  }
  return userId;
}

/**
 * Sends a message from the authenticated user to a receiver
 */
export async function sendMessage(receiverId: string, content: string) {
  try {
    const senderId = await getAuthenticatedUser();
    if (!content.trim()) {
      return { success: false, error: 'El mensaje no puede estar vacío' };
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content: content.trim(),
      },
    });

    // Revalidate paths to refresh cache
    revalidatePath('/dashboard/messages');
    revalidatePath('/admin/messages');
    
    return { success: true, data: message };
  } catch (error: any) {
    console.error('[MESSAGES] Error sending message:', error);
    return { success: false, error: error.message || 'Error al enviar el mensaje' };
  }
}

/**
 * Gets the chat history between the authenticated user and another user
 */
export async function getMessages(otherUserId: string) {
  try {
    const currentUserId = await getAuthenticatedUser();

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return { success: true, data: messages };
  } catch (error: any) {
    console.error('[MESSAGES] Error fetching messages:', error);
    return { success: false, error: error.message || 'Error al cargar mensajes' };
  }
}

/**
 * Marks all messages from a specific sender to the current user as read
 */
export async function markMessagesAsRead(senderId: string) {
  try {
    const currentUserId = await getAuthenticatedUser();

    await prisma.message.updateMany({
      where: {
        senderId,
        receiverId: currentUserId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    revalidatePath('/dashboard/messages');
    revalidatePath('/admin/messages');

    return { success: true };
  } catch (error: any) {
    console.error('[MESSAGES] Error marking read:', error);
    return { success: false, error: error.message || 'Error al marcar como leído' };
  }
}

/**
 * Returns a list of contacts the user can chat with based on their role.
 * Admins can chat with anyone (Interpreters and other Admins).
 * Interpreters can chat with Admins.
 */
export async function getChatList() {
  try {
    const currentUserId = await getAuthenticatedUser();
    
    // Get current user profile to determine role
    const profile = await prisma.userProfile.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (!profile) {
      return { success: false, error: 'Perfil no encontrado' };
    }

    const isCurrentAdmin = profile.role === 'admin';

    // Find all users with profiles
    const usersWithProfiles = await prisma.userProfile.findMany({
      where: isCurrentAdmin 
        ? { id: { not: currentUserId } } // Admin sees everyone except themselves
        : { role: 'admin' }, // Interpreter sees only Admins
      select: {
        id: true,
        displayName: true,
        role: true,
        email: true,
      },
    });

    // For each user, fetch the last message to sort the chat list and count unread messages
    const chatList = await Promise.all(
      usersWithProfiles.map(async (user: any) => {
        const lastMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: currentUserId, receiverId: user.id },
              { senderId: user.id, receiverId: currentUserId },
            ],
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const unreadCount = await prisma.message.count({
          where: {
            senderId: user.id,
            receiverId: currentUserId,
            isRead: false,
          },
        });

        return {
          id: user.id,
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          role: user.role,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
          } : null,
          unreadCount,
        };
      })
    );

    // Sort by last message date descending
    chatList.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt!).getTime() - new Date(a.lastMessage.createdAt!).getTime();
    });

    return { success: true, data: chatList };
  } catch (error: any) {
    console.error('[MESSAGES] Error loading chat list:', error);
    return { success: false, error: error.message || 'Error al cargar lista de chats' };
  }
}
