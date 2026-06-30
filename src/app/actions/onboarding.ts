'use server';

import prisma from '@/lib/prisma';
import type { ActionResult } from '@/lib/types';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { validateAction } from '@/lib/auth/actions';
import { z } from 'zod';

const db = prisma;

const BankingDetailsSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').trim(),
  bankAccount: z.string().min(1, 'Account number is required').trim(),
  bankAccountType: z.string().trim().optional().nullable(),
  bankCedula: z.string().min(1, 'ID/Cedula is required').trim(),
});

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 */
export async function acceptTerms(): Promise<ActionResult> {
  const auth = await validateAction();
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const now = new Date();
    const isRbacUser = auth.user.id.startsWith('c');
    let changedInterpreterId = auth.profile?.interpreterId ?? null;

    if (isRbacUser) {
      if (auth.profile?.interpreterId) {
        const interpreter = await db.interpreter.findUnique({
          where: { id: auth.profile.interpreterId }
        });
        if (interpreter) {
          const currentNotas = interpreter.notas || '';
          if (!currentNotas.includes('[TERMS_ACCEPTED]')) {
            changedInterpreterId = interpreter.id;
            await db.interpreter.update({
              where: { id: interpreter.id },
              data: {
                notas: `${currentNotas}\n[TERMS_ACCEPTED] signed at ${now.toISOString()}`.trim()
              },
              select: { id: true }
            });
          }
        }
      }
    } else {
      await db.userProfile.update({
        where: { id: auth.user.id },
        data: {
          termsAcceptedAt: now,
          signatureDate: now,
        },
        select: { id: true }
      });
    }

    revalidateInterpreterProfileRecords(changedInterpreterId);
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

  try {
    const validated = BankingDetailsSchema.parse(data);
    const isRbacUser = auth.user.id.startsWith('c');
    let changedInterpreterId = auth.profile?.interpreterId ?? null;

    if (isRbacUser) {
      if (auth.profile?.interpreterId) {
        await db.interpreter.update({
          where: { id: auth.profile.interpreterId },
          data: {
            banco: validated.bankName,
            cuentaPago: validated.bankAccount,
            tipoCuenta: validated.bankAccountType,
            cedulaRnc: validated.bankCedula,
          },
          select: { id: true }
        });
        changedInterpreterId = auth.profile.interpreterId;
      } else {
        return { success: false, error: 'No interpreter profile linked to this RBAC user', code: 'NOT_FOUND' };
      }
    } else {
      // ── Execute in Transaction for Supabase User ──────────────────────────
      await db.$transaction(async (tx) => {
        // 1. Update User Profile
        const profile = await tx.userProfile.update({
          where: { id: auth.user.id },
          data: {
            bankName: validated.bankName,
            bankAccount: validated.bankAccount,
            bankAccountType: validated.bankAccountType,
            bankCedula: validated.bankCedula,
          },
          select: { interpreterId: true }
        });

        // 2. Sync with Interpreter record if linked
        if (profile?.interpreterId) {
          changedInterpreterId = profile.interpreterId;
          await tx.interpreter.update({
            where: { id: profile.interpreterId },
            data: {
              banco: validated.bankName,
              cuentaPago: validated.bankAccount,
              tipoCuenta: validated.bankAccountType,
              cedulaRnc: validated.bankCedula,
            },
            select: { id: true }
          });
        }
      });
    }

    revalidateInterpreterProfileRecords(changedInterpreterId);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos bancarios inválidos', code: 'VALIDATION_ERROR' };
    }
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
    const isRbacUser = auth.user.id.startsWith('c');
    let changedInterpreterId = auth.profile?.interpreterId ?? null;

    if (isRbacUser) {
      if (auth.profile?.interpreterId) {
        await db.interpreter.update({
          where: { id: auth.profile.interpreterId },
          data: {
            documentosCompleto: true,
            metodoPago: 'Transferencia Bancaria',
            status: 'Activo'
          },
          select: { id: true }
        });
        changedInterpreterId = auth.profile.interpreterId;
      } else {
        return { success: false, error: 'No interpreter profile linked to this RBAC user', code: 'NOT_FOUND' };
      }
    } else {
      // ── Execute in Transaction for Supabase User ──────────────────────────
      await db.$transaction(async (tx) => {
        const profile = await tx.userProfile.update({
          where: { id: auth.user.id },
          data: { onboardingComplete: true },
          select: { interpreterId: true }
        });

        if (profile?.interpreterId) {
          changedInterpreterId = profile.interpreterId;
          await tx.interpreter.update({
            where: { id: profile.interpreterId },
            data: {
              documentosCompleto: true,
              metodoPago: 'Transferencia Bancaria',
              status: 'Activo'
            },
            select: { id: true }
          });
        }
      });
    }

    revalidateInterpreterProfileRecords(changedInterpreterId);
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
    const isRbacUser = auth.user.id.startsWith('c');

    if (isRbacUser) {
      if (!auth.profile?.interpreterId) {
        // If not linked to an interpreter profile, onboarding is not applicable or incomplete
        return {
          success: true,
          data: {
            termsAccepted: false,
            bankingComplete: false,
            onboardingComplete: false
          }
        };
      }

      const interpreter = await db.interpreter.findUnique({
        where: { id: auth.profile.interpreterId },
        select: {
          documentosCompleto: true,
          banco: true,
          cuentaPago: true,
          cedulaRnc: true,
          notas: true
        }
      });

      if (!interpreter) return { success: false, error: 'Interpreter profile not found', code: 'NOT_FOUND' };

      const termsAccepted = !!(interpreter.documentosCompleto || interpreter.notas?.includes('[TERMS_ACCEPTED]'));
      const bankingComplete = !!(interpreter.banco && interpreter.cuentaPago && interpreter.cedulaRnc);
      const onboardingComplete = !!interpreter.documentosCompleto;

      return {
        success: true,
        data: {
          termsAccepted,
          bankingComplete,
          onboardingComplete
        }
      };
    } else {
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
    }
  } catch (err) {
    console.error('[ONBOARDING] getOnboardingStatus error:', err);
    return { success: false, error: 'Error fetching onboarding status', code: 'INTERNAL_ERROR' };
  }
}
