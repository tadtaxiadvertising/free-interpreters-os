'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { ActionResult, UserProfile } from '@/lib/types';

export async function signup(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const displayName = formData.get('displayName') as string;
  const role = formData.get('role') as string || 'interpreter';

  if (!email || !password || !displayName) {
    return { success: false, error: 'All fields are required', code: 'VALIDATION_ERROR' };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        role: role
      }
    }
  });

  if (error) {
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }

  return { success: true };
}

export async function login(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const requestedRole = formData.get('role') as string || 'interpreter';

  if (!email || !password) {
    return { success: false, error: 'Email and password are required', code: 'VALIDATION_ERROR' };
  }

  let { error } = await supabase.auth.signInWithPassword({ email, password });

  // Auto-signup fallback for "hazlo todo" experience
  if (error && (error.message.includes('Invalid login credentials') || error.status === 400)) {
    const { error: signUpError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          display_name: email,
          role: requestedRole
        }
      }
    });
    
    if (!signUpError) {
      // If signup worked, try to sign in again
      const { error: secondSignInError } = await supabase.auth.signInWithPassword({ email, password });
      error = secondSignInError;
    } else {
      error = signUpError;
    }
  }

  if (error) {
    return { success: false, error: error.message, code: 'UNAUTHORIZED' };
  }

  // Fetch role to determine redirect
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Authentication failed', code: 'UNAUTHORIZED' };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== requestedRole) {
    // Optional: Sign out immediately if they picked the wrong portal
    await supabase.auth.signOut();
    return { 
      success: false, 
      error: `Access denied. This account does not have ${requestedRole} privileges.`, 
      code: 'UNAUTHORIZED' 
    };
  }

  const dest = profile?.role === 'admin' ? '/admin' : '/dashboard';
  redirect(dest);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('user_profiles')
    .select('id, role, interpreter_id, display_name, created_at')
    .eq('id', user.id)
    .single();

  return data as UserProfile | null;
}
