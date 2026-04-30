'use server';

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
const db = prisma as any;
import { revalidatePath } from 'next/cache';

export type ProfileUpdateInput = {
  phone?: string;
  country?: string;
  paymentMethod?: string;
  paymentAccount?: string;
  notes?: string;
};

export async function updateInterpreterProfile(input: ProfileUpdateInput) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: 'Unauthorized' };

  try {
    const profile = await db.userProfile.findFirst({
      where: { 
        OR: [
          { id: userId },
          { clerkId: userId }
        ]
      },
      select: { interpreterId: true }
    });

    if (!profile?.interpreterId) {
      return { success: false, error: 'No interpreter profile found' };
    }

    const updated = await db.interpreter.update({
      where: { id: profile.interpreterId },
      data: {
        telefono: input.phone,
        pais: input.country,
        metodoPago: input.paymentMethod,
        cuentaPago: input.paymentAccount,
        notas: input.notes
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/earnings');
    
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Profile Update Error:', error);
    return { success: false, error: 'Failed to update profile.' };
  }
}
