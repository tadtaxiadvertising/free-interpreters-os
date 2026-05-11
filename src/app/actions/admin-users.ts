'use server';

import prismaClient from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';

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

export async function updateUserRole(userId: string, role: string) {
  const { user } = await auth();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  await prisma.userProfile.update({
    where: { id: userId },
    data: { role: role as any }
  });

  revalidatePath('/admin/users');
  return { success: true };
}

export async function linkUserToInterpreter(userId: string, interpreterId: number) {
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
