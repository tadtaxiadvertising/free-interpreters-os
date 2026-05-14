'use server';

import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import { revalidatePath } from 'next/cache';

import { z } from 'zod';
import type { ActionResult } from '@/lib/types';

const db = prisma;

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

export async function updateInterpreterProfile(rawInput: ProfileUpdateInput): Promise<ActionResult<void>> {
  const auth = await validateAction('interpreter');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  const parseResult = ProfileUpdateSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: 'Invalid profile data', code: 'VALIDATION_ERROR' };
  }
  const input = parseResult.data;

  try {
    // 1. Update UserProfile via Prisma
    const profile = await db.userProfile.update({
      where: { id: auth.user.id },
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
          },
          select: { id: true }
        });
      } catch (interpError: unknown) {
        const errorMsg = interpError instanceof Error ? interpError.message : 'Unknown error';
        console.warn('Sync with interpreters table failed:', errorMsg);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/earnings');
    
    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected Profile Update Error:', errorMsg);
    return { success: false, error: 'An unexpected error occurred while updating profile.' };
  }
}

