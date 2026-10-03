'use server';

import prisma from '@/lib/prisma';
import { resolveCurrentIdentity, OnboardingStatus } from '@/lib/identity/resolve-user';
import { revalidateInterpreterProfileRecords } from '@/lib/cache/revalidate-interpreter';
import { z } from 'zod';

const db = prisma;

const CEDULA_REGEX = /^\d{3}-\d{7}-\d{1}$/;

const BankingDetailsSchema = z.object({
  bankName: z.string().min(1, 'Selecciona un banco').trim(),
  bankAccount: z.string().min(5, 'El número de cuenta debe tener al menos 5 dígitos').regex(/^\d+$/, 'Solo números permitidos').trim(),
  bankAccountType: z.enum(['Ahorro', 'Corriente'], { message: 'Selecciona el tipo de cuenta' }),
  bankCedula: z.string().regex(CEDULA_REGEX, 'Formato de cédula: XXX-XXXXXXX-X').trim(),
});

export type OnboardingState = {
  status: OnboardingStatus;
  step: 'legal' | 'banking' | 'tutorial' | 'complete' | null;
  version: number;
  completedAt: Date | null;
  hasTerms: boolean;
  hasBanking: boolean;
};

/**
 * Get the current user's onboarding state
 * Uses the centralized identity resolver
 */
export async function getOnboardingState(): Promise<{ success: true; data: OnboardingState } | { success: false; error: string; code: string }> {
  const identity = await resolveCurrentIdentity();
  if (!identity) {
    return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (identity.role === 'admin') {
    return { 
      success: true, 
      data: { 
        status: 'COMPLETED', 
        step: 'complete', 
        version: 1, 
        completedAt: new Date(), 
        hasTerms: true, 
        hasBanking: true 
      } 
    };
  }

  // Fetch fresh profile data
  const profile = await db.userProfile.findUnique({
    where: { id: identity.userId },
    include: {
      interpreter: {
        select: {
          id: true,
          documentosCompleto: true,
          banco: true,
          cuentaPago: true,
          cedulaRnc: true,
          notas: true,
        }
      }
    }
  });

  if (!profile) {
    return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };
  }

  const isAuthJsUser = identity.provider === 'authjs';
  const interpreter = profile.interpreter;

  let hasTerms = false;
  let hasBanking = false;

  if (isAuthJsUser && interpreter) {
    hasTerms = interpreter.documentosCompleto === true || (interpreter.notas?.includes('[TERMS_ACCEPTED]') ?? false);
    hasBanking = interpreter.banco != null && interpreter.cuentaPago != null && interpreter.cedulaRnc != null;
  } else {
    hasTerms = profile.termsAcceptedAt != null;
    hasBanking = profile.bankName != null && profile.bankAccount != null && profile.bankCedula != null;
  }

  let status: OnboardingStatus;
  let step: OnboardingState['step'];
  let completedAt: Date | null = null;

  if (identity.onboardingStatus === 'COMPLETED') {
    status = 'COMPLETED';
    step = 'complete';
    completedAt = identity.onboardingCompletedAt;
  } else if (identity.onboardingStatus === 'NEEDS_REVIEW') {
    status = 'NEEDS_REVIEW';
    step = hasTerms ? 'banking' : 'legal';
  } else if (identity.onboardingStatus === 'IN_PROGRESS') {
    status = 'IN_PROGRESS';
    step = identity.onboardingStep;
  } else {
    status = 'NOT_STARTED';
    step = 'legal';
  }

  return {
    success: true,
    data: {
      status,
      step,
      version: identity.onboardingVersion,
      completedAt,
      hasTerms,
      hasBanking,
    },
  };
}

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 * Idempotent: safe to call multiple times.
 */
export async function acceptTerms(): Promise<{ success: true } | { success: false; error: string; code: string }> {
  const identity = await resolveCurrentIdentity();
  if (!identity) {
    return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (identity.role === 'admin') {
    return { success: true }; // Admins don't need onboarding
  }

  if (identity.onboardingStatus === 'COMPLETED' || identity.onboardingStatus === 'NEEDS_REVIEW') {
    return { success: false, error: 'Onboarding ya fue completado — no puedes modificar los datos', code: 'CONFLICT' };
  }

  const now = new Date();

  try {
    if (identity.provider === 'authjs') {
      if (!identity.interpreterId) {
        return { success: false, error: 'No interpreter profile linked to this user', code: 'NOT_FOUND' };
      }
      
      const interpreter = await db.interpreter.findUnique({
        where: { id: identity.interpreterId },
        select: { id: true, notas: true },
      });

      if (!interpreter) {
        return { success: false, error: 'Interpreter profile not found', code: 'NOT_FOUND' };
      }

      const currentNotas = interpreter.notas || '';
      if (!currentNotas.includes('[TERMS_ACCEPTED]')) {
        await db.interpreter.update({
          where: { id: interpreter.id },
          data: {
            notas: `${currentNotas}\n[TERMS_ACCEPTED] signed at ${now.toISOString()}`.trim(),
          },
        });
      }
    } else {
      // Supabase user - update UserProfile
      await db.userProfile.update({
        where: { id: identity.userId },
        data: {
          termsAcceptedAt: now,
          signatureDate: now,
        },
      });
    }

    revalidateInterpreterProfileRecords(identity.interpreterId);
    return { success: true };
  } catch (error) {
    console.error('[ONBOARDING] acceptTerms error:', error);
    return { success: false, error: 'Error inesperado al procesar la firma', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Save RD banking details for the interpreter's payment profile.
 * Idempotent: safe to call multiple times.
 */
export async function saveBankingDetails(data: {
  bankName: string;
  bankAccount: string;
  bankAccountType?: string;
  bankCedula: string;
}): Promise<{ success: true } | { success: false; error: string; code: string }> {
  const identity = await resolveCurrentIdentity();
  if (!identity) {
    return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (identity.role === 'admin') {
    return { success: true };
  }

  if (identity.onboardingStatus === 'COMPLETED' || identity.onboardingStatus === 'NEEDS_REVIEW') {
    return { success: false, error: 'Onboarding ya fue completado — los datos bancarios no pueden ser modificados', code: 'CONFLICT' };
  }

  let validated: z.infer<typeof BankingDetailsSchema>;
  try {
    validated = BankingDetailsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos bancarios inválidos', code: 'VALIDATION_ERROR' };
    }
    throw error;
  }

  try {
    if (identity.provider === 'authjs') {
      if (!identity.interpreterId) {
        return { success: false, error: 'No interpreter profile linked to this user', code: 'NOT_FOUND' };
      }

      await db.interpreter.update({
        where: { id: identity.interpreterId },
        data: {
          banco: validated.bankName,
          cuentaPago: validated.bankAccount,
          tipoCuenta: validated.bankAccountType,
          cedulaRnc: validated.bankCedula,
        },
      });
    } else {
      // Supabase user - update both UserProfile and linked Interpreter in transaction
      await db.$transaction(async (tx) => {
        const profile = await tx.userProfile.update({
          where: { id: identity.userId },
          data: {
            bankName: validated.bankName,
            bankAccount: validated.bankAccount,
            bankAccountType: validated.bankAccountType,
            bankCedula: validated.bankCedula,
          },
          select: { interpreterId: true },
        });

        if (profile?.interpreterId) {
          await tx.interpreter.update({
            where: { id: profile.interpreterId },
            data: {
              banco: validated.bankName,
              cuentaPago: validated.bankAccount,
              tipoCuenta: validated.bankAccountType,
              cedulaRnc: validated.bankCedula,
            },
          });
        }
      });
    }

    revalidateInterpreterProfileRecords(identity.interpreterId);
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
 * Idempotent: safe to call multiple times.
 */
export async function completeOnboarding(): Promise<{ success: true } | { success: false; error: string; code: string }> {
  const identity = await resolveCurrentIdentity();
  if (!identity) {
    return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (identity.role === 'admin') {
    return { success: true };
  }

  // Allow completion even if already completed (idempotent)
  // But reject if in NEEDS_REVIEW state (data inconsistency)
  if (identity.onboardingStatus === 'NEEDS_REVIEW') {
    return { success: false, error: 'Onboarding requiere revisión — datos inconsistentes', code: 'CONFLICT' };
  }

  try {
    if (identity.provider === 'authjs') {
      if (!identity.interpreterId) {
        return { success: false, error: 'No interpreter profile linked to this user', code: 'NOT_FOUND' };
      }

      await db.interpreter.update({
        where: { id: identity.interpreterId },
        data: {
          documentosCompleto: true,
          metodoPago: 'Transferencia Bancaria',
          status: 'Activo',
        },
      });
    } else {
      // Supabase user - update BOTH canonical and legacy fields in transaction
      await db.$transaction(async (tx) => {
        const profile = await tx.userProfile.update({
          where: { id: identity.userId },
          data: { 
            onboardingComplete: true,
            // onboardingCompletedAt would be set via migration or separate field
          },
          select: { interpreterId: true },
        });

        if (profile?.interpreterId) {
          await tx.interpreter.update({
            where: { id: profile.interpreterId },
            data: {
              documentosCompleto: true,
              metodoPago: 'Transferencia Bancaria',
              status: 'Activo',
            },
          });
        }
      });
    }

    revalidateInterpreterProfileRecords(identity.interpreterId);
    return { success: true };
  } catch (error) {
    console.error('[ONBOARDING] completeOnboarding error:', error);
    return { success: false, error: 'Error inesperado al finalizar el onboarding', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Check if user can skip onboarding (already completed)
 */
export async function canSkipOnboarding(): Promise<{ success: true; data: boolean } | { success: false; error: string; code: string }> {
  const identity = await resolveCurrentIdentity();
  if (!identity) {
    return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };
  }

  if (identity.role === 'admin') {
    return { success: true, data: true };
  }

  return { 
    success: true, 
    data: identity.onboardingStatus === 'COMPLETED' 
  };
}