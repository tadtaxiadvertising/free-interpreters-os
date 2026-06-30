'use server';

import prismaClient from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { UserRole } from '@/lib/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';

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

  const updated = await prisma.userProfile.update({
    where: { id: userId },
    data: { role },
    select: { interpreterId: true }
  });

  revalidateInterpreterProfileRecords(updated.interpreterId);
  return { success: true };
}

export async function linkUserToInterpreter(userId: string, interpreterId: number | null) {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  const previous = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { interpreterId: true }
  });

  await prisma.userProfile.update({
    where: { id: userId },
    data: { interpreterId }
  });

  revalidateInterpreterProfileRecords(previous?.interpreterId);
  revalidateInterpreterProfileRecords(interpreterId);
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

    revalidateInterpreterProfileRecords(updated.interpreterId);
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
    const deleted = await prisma.userProfile.delete({
      where: { id: userId },
      select: { interpreterId: true }
    });

    // Delete in Supabase Auth
    try {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (supabaseError) {
      console.error('Supabase delete account warning:', supabaseError);
    }

    revalidateInterpreterProfileRecords(deleted.interpreterId);
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

export async function syncAllSupabaseUsers() {
  try {
    const { user } = await auth();
    if (!user || user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    const supabaseAdmin = createAdminClient();
    
    // Fetch all users from Supabase Auth
    const { data: { users: supabaseUsers }, error } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000
    });

    if (error) {
      console.error('Error listing Supabase users:', error);
      return { success: false, error: error.message };
    }

    let syncedCount = 0;
    
    for (const sUser of supabaseUsers) {
      if (!sUser.email) continue;
      
      // Check if profile already exists in public.user_profiles
      const existing = await prisma.userProfile.findUnique({
        where: { id: sUser.id }
      });

      if (!existing) {
        // Auto-detect role
        const emailLower = sUser.email.toLowerCase();
        let role = 'interpreter';
        
        if (
          emailLower === 'interpretersfree@gmail.com' ||
          emailLower === 'melvinramonduranmesa@gmail.com' ||
          emailLower === 'admin@freeinterpreters.com' ||
          emailLower.includes('admin')
        ) {
          role = 'admin';
        }

        // Auto-link to matching physical interpreter by email
        const interpreter = await prisma.interpreter.findUnique({
          where: { emailCorporativo: sUser.email },
          select: { id: true }
        });

        await prisma.userProfile.create({
          data: {
            id: sUser.id,
            email: sUser.email,
            displayName: sUser.user_metadata?.display_name || sUser.email.split('@')[0],
            role: role,
            interpreterId: interpreter ? interpreter.id : null,
            onboardingComplete: true
          }
        });
        
        syncedCount++;
      }
    }

    revalidatePath('/admin/users');
    return { success: true, syncedCount };
  } catch (error: any) {
    console.error('Sync Users Exception:', error);
    return { success: false, error: error.message || 'Error al sincronizar' };
  }
}
