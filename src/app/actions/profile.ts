'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ProfileUpdateInput = {
  phone?: string;
  country?: string;
  metodoPago?: string;
  banco?: string;
  tipoCuenta?: string;
  cuentaPago?: string;
  cedulaRnc?: string;
  notes?: string;
};

export async function updateInterpreterProfile(input: ProfileUpdateInput) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('interpreter_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.interpreter_id) {
      return { success: false, error: 'No interpreter profile found' };
    }

    const { data: updated, error: updateError } = await supabase
      .from('interpreters')
      .update({
        telefono: input.phone,
        pais: input.country,
        metodo_pago: input.metodoPago,
        banco: input.banco,
        tipo_cuenta: input.tipoCuenta,
        cuenta_pago: input.cuentaPago,
        cedula_rnc: input.cedulaRnc,
        notas: input.notes
      })
      .eq('id', profile.interpreter_id)
      .select()
      .single();

    if (updateError) {
      console.error('Profile Update Error:', updateError.message);
      return { success: false, error: updateError.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/earnings');
    
    return { success: true, data: updated };
  } catch (error: any) {
    console.error('Unexpected Profile Update Error:', error);
    return { success: false, error: 'An unexpected error occurred while updating profile.' };
  }
}
