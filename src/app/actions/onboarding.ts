'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 */
export async function acceptTerms(): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

    const now = new Date().toISOString();
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        terms_accepted_at: now,
        signature_date: now,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[ONBOARDING] acceptTerms error:', error.message);
      return { success: false, error: `Error al aceptar términos: ${error.message}`, code: 'INTERNAL_ERROR' };
    }

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

    // 1. Update User Profile using Admin Client to bypass RLS during onboarding
    const supabaseAdmin = createAdminClient();
    
    // Debug: check for duplicates
    const { data: checkData } = await supabaseAdmin.from('user_profiles').select('id').eq('id', user.id);
    if (checkData && checkData.length > 1) {
      console.warn(`[ONBOARDING] CRITICAL: Found ${checkData.length} duplicate profiles for user ${user.id}`);
    }

    const { data: updateResults, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update({
        bank_name: data.bankName.trim(),
        bank_account: data.bankAccount.trim(),
        bank_account_type: data.bankAccountType?.trim() || null,
        bank_cedula: data.bankCedula.trim(),
      })
      .eq('id', user.id)
      .select('interpreter_id');

    if (profileError) {
      console.error('[ONBOARDING] saveBankingDetails (profile) error:', profileError.message, profileError.details);
      return { success: false, error: `Error al actualizar perfil: ${profileError.message}`, code: 'INTERNAL_ERROR' };
    }

    const profile = updateResults && updateResults.length > 0 ? updateResults[0] : null;

    if (!profile) {
      return { success: false, error: 'No se encontró tu perfil de usuario. Por favor, contacta a soporte.', code: 'NOT_FOUND' };
    }

    // 2. Sync with Interpreter record if linked
    if (profile?.interpreter_id) {
      const { error: intError } = await supabaseAdmin
        .from('interpreters')
        .update({
          banco: data.bankName.trim(),
          cuenta_pago: data.bankAccount.trim(),
          tipo_cuenta: data.bankAccountType?.trim() || null,
          cedula_rnc: data.bankCedula.trim(),
        })
        .eq('id', profile.interpreter_id);

      if (intError) {
        console.warn('[ONBOARDING] saveBankingDetails (interpreter sync) warning:', intError.message);
        // We don't fail the whole action if sync fails, but we log it
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

    // Update user profile using Admin Client
    const supabaseAdmin = createAdminClient();
    const { data: updateResults, error } = await supabaseAdmin
      .from('user_profiles')
      .update({ onboarding_complete: true })
      .eq('id', user.id)
      .select('interpreter_id');

    if (error) {
      console.error('[ONBOARDING] completeOnboarding error:', error.message);
      return { success: false, error: `Error al completar el proceso: ${error.message}`, code: 'INTERNAL_ERROR' };
    }

    const profile = updateResults && updateResults.length > 0 ? updateResults[0] : null;

    if (!profile) {
      return { success: false, error: 'Perfil no encontrado al intentar finalizar.', code: 'NOT_FOUND' };
    }

    // Sync with interpreter record using Admin Client
    if (profile?.interpreter_id) {
      const { error: intError } = await supabaseAdmin
        .from('interpreters')
        .update({
          documentos_completo: true,
          metodo_pago: 'Transferencia Bancaria',
          status: 'Activo'
        })
        .eq('id', profile.interpreter_id);

      if (intError) {
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('terms_accepted_at, bank_name, bank_account, bank_account_type, bank_cedula, onboarding_complete')
    .eq('id', user.id);
    
  const profile = profiles && profiles.length > 0 ? profiles[0] : null;

  if (error || !profile) {
    return { success: false, error: 'Profile not found', code: 'NOT_FOUND' };
  }

  return {
    success: true,
    data: {
      termsAccepted: !!profile.terms_accepted_at,
      bankingComplete: !!(profile.bank_name && profile.bank_account && profile.bank_cedula),
      onboardingComplete: profile.onboarding_complete,
    },
  };
}
