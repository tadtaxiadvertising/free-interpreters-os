'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type ProfileUpdateInput = {
  phone?: string;
  country?: string;
  paymentMethod?: string;
  paymentAccount?: string;
  notes?: string;
};

export async function updateInterpreterProfile(input: ProfileUpdateInput) {
  const supabase = await createClient();

  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    // 2. Update the interpreter record linked to this email
    // Using emailCorporativo as the unique link between auth and interpreter record
    const updated = await prisma.interpreter.update({
      where: { emailCorporativo: user.email },
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
    return { success: false, error: 'Failed to update profile. Make sure your profile is linked.' };
  }
}
