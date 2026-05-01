'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserProfile } from '@/lib/types';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(`[AUTH_LOGIN] Login failed for ${email}:`, error.message);
    return { error: error.message };
  }

  console.log(`[AUTH_LOGIN] Login successful for ${email}, fetching profile...`);

  // Get user profile to determine redirect
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('[AUTH_LOGIN] Error fetching profile:', profileError.message);
  }

  const role = profile?.role || 'interpreter';
  console.log(`[AUTH_LOGIN] User role: ${role}`);

  return { success: true, role };
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const role = (formData.get('role') as string) || 'interpreter';

  console.log(`[AUTH_REGISTER] Attempting registration for: ${email}`);

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createClient();

  // 1. Sign up user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: name || email.split('@')[0],
      },
    },
  });

  if (error) {
    console.error('[AUTH_REGISTER] Supabase Auth Error:', error.message);
    return { error: error.message };
  }

  if (data.user) {
    console.log(`[AUTH_REGISTER] Auth user created: ${data.user.id}`);
    
    // Use Admin client for DB operations to bypass RLS and ensure success during signup
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    // 2. Try to find a matching interpreter by email
    const { data: interpreter } = await supabaseAdmin
      .from('interpreters')
      .select('id')
      .eq('email_corporativo', email)
      .maybeSingle();

    console.log(`[AUTH_REGISTER] Linking to interpreter: ${interpreter?.id || 'none'}`);

    // 3. Upsert UserProfile record (The DB trigger might have already created a basic one)
    const { error: profileError } = await supabaseAdmin.from('user_profiles').upsert({
      id: data.user.id,
      email,
      display_name: name || email.split('@')[0],
      role: role,
      interpreter_id: interpreter?.id || null,
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('[AUTH_REGISTER] Profile upsert error:', profileError.message, profileError.details);
      return { 
        success: true, 
        role, 
        warning: 'Account created but profile linking had an issue. Please contact support.' 
      };
    }
    
    console.log('[AUTH_REGISTER] Registration successful');
  } else {
    console.warn('[AUTH_REGISTER] signUp returned no user and no error (check if email confirmation is required)');
  }

  return { success: true, role };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    console.error('Error fetching profile:', error?.message);
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as any,
    interpreter_id: profile.interpreter_id,
    display_name: profile.display_name || '',
    terms_accepted_at: profile.terms_accepted_at,
    signature_date: profile.signature_date,
    bank_name: profile.bank_name,
    bank_account: profile.bank_account,
    bank_account_type: profile.bank_account_type,
    bank_cedula: profile.bank_cedula,
    onboarding_complete: profile.onboarding_complete || false,
    created_at: profile.created_at,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
