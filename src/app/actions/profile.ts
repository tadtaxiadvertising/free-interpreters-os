'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import type { ActionResult } from '@/lib/types';

const db = prisma as any;

const ProfileUpdateSchema = z.object({
  phone: z.string().optional(),
  country: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankAccountType: z.string().optional(),
  bankCedula: z.string().optional(),
  notes: z.string().optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

export async function updateInterpreterProfile(rawInput: ProfileUpdateInput): Promise<ActionResult<any>> {
  const parseResult = ProfileUpdateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid profile data', code: 'VALIDATION_ERROR' };
  }
  const input = parseResult.data;

  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };

  try {
    // 1. Update UserProfile via Prisma
    const profile = await db.userProfile.update({
      where: { id: user.id },
      data: {
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        bankAccountType: input.bankAccountType,
        bankCedula: input.bankCedula,
      },
      select: { interpreterId: true }
    });

    if (!profile) {
      return { success: false, error: 'User profile not found' };
    }

    // 2. Sync with Interpreters table via Prisma
    if (profile.interpreterId) {
      try {
        await db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            telefono: input.phone,
            pais: input.country,
            banco: input.bankName,
            cuentaPago: input.bankAccount,
            tipoCuenta: input.bankAccountType,
            cedulaRnc: input.bankCedula,
            notas: input.notes
          }
        });
      } catch (interpError: any) {
        console.warn('Sync with interpreters table failed:', interpError.message);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/earnings');
    
    return { success: true };
  } catch (error: any) {
    console.error('Unexpected Profile Update Error:', error.message);
    return { success: false, error: 'An unexpected error occurred while updating profile.' };
  }
}

