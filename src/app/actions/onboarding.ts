'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/**
 * Accept legal terms — records the signatureDate on the user's profile.
 */
export async function acceptTerms(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('user_profiles')
    .update({
      terms_accepted_at: now,
      signature_date: now,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[ONBOARDING] acceptTerms error:', error.message);
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Save RD banking details for the interpreter's payment profile.
 */
export async function saveBankingDetails(data: {
  bankName: string;
  bankAccount: string;
  bankCedula: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  if (!data.bankName?.trim() || !data.bankAccount?.trim() || !data.bankCedula?.trim()) {
    return { success: false, error: 'All banking fields are required', code: 'VALIDATION_ERROR' };
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      bank_name: data.bankName.trim(),
      bank_account: data.bankAccount.trim(),
      bank_cedula: data.bankCedula.trim(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('[ONBOARDING] saveBankingDetails error:', error.message);
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Mark onboarding as complete — enables full dashboard access.
 */
export async function completeOnboarding(): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated', code: 'UNAUTHORIZED' };

  const { error } = await supabase
    .from('user_profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id);

  if (error) {
    console.error('[ONBOARDING] completeOnboarding error:', error.message);
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }

  revalidatePath('/dashboard');
  return { success: true };
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

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('terms_accepted_at, bank_name, bank_account, bank_cedula, onboarding_complete')
    .eq('id', user.id)
    .single();

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
