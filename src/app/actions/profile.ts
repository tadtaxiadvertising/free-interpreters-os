'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ProfileUpdateInput = {
  phone?: string;
  country?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountType?: string;
  bankCedula?: string;
  notes?: string;
};

export async function updateInterpreterProfile(input: ProfileUpdateInput) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    // 1. Update UserProfile (New SSOT for banking)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .update({
        bank_name: input.bankName,
        bank_account: input.bankAccount,
        bank_account_type: input.bankAccountType,
        bank_cedula: input.bankCedula,
      })
      .eq('id', user.id)
      .select('interpreter_id')
      .single();

    if (profileError) {
      console.error('User Profile Update Error:', profileError.message);
      return { success: false, error: profileError.message };
    }

    // 2. Sync with Interpreters table (Legacy compatibility)
    if (profile?.interpreter_id) {
      const { error: interpError } = await supabase
        .from('interpreters')
        .update({
          telefono: input.phone,
          pais: input.country,
          banco: input.bankName,
          cuenta_pago: input.bankAccount,
          tipo_cuenta: input.bankAccountType,
          cedula_rnc: input.bankCedula,
          notas: input.notes
        })
        .eq('id', profile.interpreter_id);

      if (interpError) {
        console.warn('Sync with interpreters table failed:', interpError.message);
      }
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/earnings');
    
    return { success: true };
  } catch (error: any) {
    console.error('Unexpected Profile Update Error:', error);
    return { success: false, error: 'An unexpected error occurred while updating profile.' };
  }
}
