'use server';

import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

const db = prisma as any;

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 */
export async function acceptTerms(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const now = new Date();
    
    // Use Prisma instead of Supabase client
    await db.userProfile.update({
      where: { id: user.id },
      data: {
        termsAcceptedAt: now,
        signatureDate: now,
      }
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('[ONBOARDING] acceptTerms fatal error:', err);
    return { success: false, error: 'Error inesperado al procesar la firma', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Save RD banking details for the interpreter's payment profile.
 */
export async function saveBankingDetails(data: {
  bankName: string;
  bankAccount: string;
  bankAccountType?: string;
  bankCedula: string;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    if (!data.bankName?.trim() || !data.bankAccount?.trim() || !data.bankCedula?.trim()) {
      return { success: false, error: 'Todos los campos bancarios son obligatorios', code: 'VALIDATION_ERROR' };
    }

    // 1. Update User Profile via Prisma
    const profile = await db.userProfile.update({
      where: { id: user.id },
      data: {
        bankName: data.bankName.trim(),
        bankAccount: data.bankAccount.trim(),
        bankAccountType: data.bankAccountType?.trim() || null,
        bankCedula: data.bankCedula.trim(),
      },
      select: { interpreterId: true }
    });

    if (!profile) {
      return { success: false, error: 'No se encontró tu perfil de usuario.', code: 'NOT_FOUND' };
    }

    // 2. Sync with Interpreter record if linked
    if (profile.interpreterId) {
      try {
        await db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            banco: data.bankName.trim(),
            cuentaPago: data.bankAccount.trim(),
            tipoCuenta: data.bankAccountType?.trim() || null,
            cedulaRnc: data.bankCedula.trim(),
          }
        });
      } catch (intError: any) {
        console.warn('[ONBOARDING] Sync interpreter error:', intError.message);
      }
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('[ONBOARDING] saveBankingDetails fatal error:', err);
    return { success: false, error: 'Ocurrió un error inesperado al guardar los datos', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Mark onboarding as complete — enables full dashboard access.
 */
export async function completeOnboarding(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    // Update user profile via Prisma
    const profile = await db.userProfile.update({
      where: { id: user.id },
      data: { onboardingComplete: true },
      select: { interpreterId: true }
    });

    if (!profile) {
      return { success: false, error: 'Perfil no encontrado al intentar finalizar.', code: 'NOT_FOUND' };
    }

    // Sync with interpreter record via Prisma
    if (profile.interpreterId) {
      try {
        await db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            documentosCompleto: true,
            metodoPago: 'Transferencia Bancaria',
            status: 'Activo'
          }
        });
      } catch (intError: any) {
        console.warn('[ONBOARDING] Sync interpreter error:', intError.message);
      }
    }

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('[ONBOARDING] completeOnboarding fatal error:', err);
    return { success: false, error: 'Error inesperado al finalizar el onboarding', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Get onboarding status for the current user.
 */
export async function getOnboardingStatus(): Promise<ActionResult<{
  termsAccepted: boolean;
  bankingComplete: boolean;
  onboardingComplete: boolean;
}>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    // Use Prisma for profile lookup
    const profile = await db.userProfile.findUnique({
      where: { id: user.id },
      select: {
        termsAcceptedAt: true,
        bankName: true,
        bankAccount: true,
        bankCedula: true,
        onboardingComplete: true
      }
    });

    if (!profile) {
      return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };
    }

    return {
      success: true,
      data: {
        termsAccepted: !!profile.termsAcceptedAt,
        bankingComplete: !!(profile.bankName && profile.bankAccount && profile.bankCedula),
        onboardingComplete: profile.onboardingComplete,
      },
    };
  } catch (err: any) {
    console.error('[ONBOARDING] getOnboardingStatus error:', err.message);
    return { success: false, error: 'Error fetching onboarding status', code: 'INTERNAL_ERROR' };
  }
}

