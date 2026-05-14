'use server';

import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 */
export async function acceptTerms(): Promise<ActionResult> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const now = new Date();
    await db.userProfile.update({
      where: { id: auth.user.id },
      data: {
        termsAcceptedAt: now,
        signatureDate: now,
      }
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('[ONBOARDING] acceptTerms error:', error);
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
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  if (!data.bankName?.trim() || !data.bankAccount?.trim() || !data.bankCedula?.trim()) {
    return { success: false, error: 'Todos los campos bancarios son obligatorios', code: 'VALIDATION_ERROR' };
  }

  try {
    // ── Execute in Transaction ──────────────────────────
    await db.$transaction(async (tx) => {
      // 1. Update User Profile
      const profile = await tx.userProfile.update({
        where: { id: auth.user.id },
        data: {
          bankName: data.bankName.trim(),
          bankAccount: data.bankAccount.trim(),
          bankAccountType: data.bankAccountType?.trim() || null,
          bankCedula: data.bankCedula.trim(),
        },
        select: { interpreterId: true }
      });

      // 2. Sync with Interpreter record if linked
      if (profile?.interpreterId) {
        await tx.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            banco: data.bankName.trim(),
            cuentaPago: data.bankAccount.trim(),
            tipoCuenta: data.bankAccountType?.trim() || null,
            cedulaRnc: data.bankCedula.trim(),
          },
        });
      }
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('[ONBOARDING] saveBankingDetails error:', error);
    return { success: false, error: 'Ocurrió un error inesperado al guardar los datos', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Mark onboarding as complete — enables full dashboard access.
 */
export async function completeOnboarding(): Promise<ActionResult> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    // ── Execute in Transaction ──────────────────────────
    await db.$transaction(async (tx) => {
      const profile = await tx.userProfile.update({
        where: { id: auth.user.id },
        data: { onboardingComplete: true },
        select: { interpreterId: true }
      });

      if (profile?.interpreterId) {
        await tx.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            documentosCompleto: true,
            metodoPago: 'Transferencia Bancaria',
            status: 'Activo'
          }
        });
      }
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('[ONBOARDING] completeOnboarding error:', error);
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
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    // Use the profile already fetched by validateAction/getCurrentUser if available
    // But since profile is selective in validateAction, let's re-fetch or improve helper.
    // For now, let's just use the auth.profile if it has the fields, or fetch specifically.
    const profile = await db.userProfile.findUnique({
      where: { id: auth.user.id },
      select: {
        termsAcceptedAt: true,
        bankName: true,
        bankAccount: true,
        bankCedula: true,
        onboardingComplete: true
      }
    });

    if (!profile) return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };

    return {
      success: true,
      data: {
        termsAccepted: !!profile.termsAcceptedAt,
        bankingComplete: !!(profile.bankName && profile.bankAccount && profile.bankCedula),
        onboardingComplete: profile.onboardingComplete,
      },
    };
  } catch (err) {
    console.error('[ONBOARDING] getOnboardingStatus error:', err);
    return { success: false, error: 'Error fetching onboarding status', code: 'INTERNAL_ERROR' };
  }
}

