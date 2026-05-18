'use server';

import prismaClient from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';

const prisma = prismaClient;

export async function getAdminUsers() {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return prisma.userProfile.findMany({
    include: {
      interpreter: {
        select: {
          id: true,
          name: true,
          campaign: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  await prisma.userProfile.update({
    where: { id: userId },
    data: { role }
  });

  revalidatePath('/admin/users');
  return { success: true };
}

export async function linkUserToInterpreter(userId: string, interpreterId: number | null) {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  await prisma.userProfile.update({
    where: { id: userId },
    data: { interpreterId }
  });

  revalidatePath('/admin/users');
  return { success: true };
}

export async function updateUserPassword(userId: string, newPassword: string) {
  try {
    const { user } = await auth();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      console.error('Supabase Auth Reset Password Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Reset Password Exception:', error);
    return { success: false, error: error.message || 'Error del servidor' };
  }
}

export async function updateUserProfile(userId: string, data: { displayName: string; email: string }) {
  try {
    const { user } = await auth();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    // Update locally in PostgreSQL
    const updated = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        displayName: data.displayName,
        email: data.email
      }
    });

    // Sync to Supabase Auth
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: data.email,
        user_metadata: { display_name: data.displayName }
      });
    } catch (supabaseError) {
      console.error('Supabase sync warning:', supabaseError);
    }

    revalidatePath('/admin/users');
    return { success: true, profile: updated };
  } catch (error: any) {
    console.error('Update Profile Exception:', error);
    return { success: false, error: error.message || 'Error al actualizar el perfil' };
  }
}

export async function deleteUserAccess(userId: string) {
  try {
    const { user } = await auth();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    // De-link/Delete from local DB first to avoid dependency failures
    await prisma.userProfile.delete({
      where: { id: userId }
    });

    // Delete in Supabase Auth
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (supabaseError) {
      console.error('Supabase delete account warning:', supabaseError);
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error: any) {
    console.error('Delete User Exception:', error);
    return { success: false, error: error.message || 'Error al eliminar usuario' };
  }
}

export async function getAllInterpretersList() {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  return prisma.interpreter.findMany({
    select: {
      id: true,
      name: true,
      emailCorporativo: true,
      campaign: true
    },
    orderBy: {
      name: 'asc'
    }
  });
}
