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
    console.error('Login error:', error.message);
    return { error: error.message };
  }

  // Get user profile to determine redirect
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  return { success: true, role: profile?.role || 'interpreter' };
}

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const role = (formData.get('role') as string) || 'interpreter';

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
    console.error('Registration error:', error.message);
    return { error: error.message };
  }

  if (data.user) {
    // 2. Create UserProfile record (if not handled by trigger)
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: data.user.id,
      email,
      display_name: name || email.split('@')[0],
      role: role,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError.message);
      // We don't fail here as the user is already created in Auth
    }
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
    role: profile.role as any,
    interpreter_id: profile.interpreter_id,
    display_name: profile.display_name || '',
    created_at: profile.created_at,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
