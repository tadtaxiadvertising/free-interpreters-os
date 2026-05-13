'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserProfile, UserRole } from '@/lib/types';
import prismaClient from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const prisma = prismaClient;

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

  console.log(`[AUTH_LOGIN] Login successful for ${email}, fetching profile via Prisma...`);

  // Use Prisma instead of Supabase client to avoid DNS/fetch issues
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: data.user.id },
      select: { role: true }
    });

    const role = profile?.role || 'interpreter';
    console.log(`[AUTH_LOGIN] User role: ${role}`);
    return { success: true, role };
  } catch (dbError: unknown) {
    const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown database error';
    console.error('[AUTH_LOGIN] Prisma error fetching profile:', errorMsg);
    // Fallback to minimal info if DB is struggling
    return { success: true, role: 'interpreter' };
  }
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

  // 1. Sign up user in Supabase Auth (Still needs fetch for Auth)
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
    console.log(`[AUTH_REGISTER] Auth user created: ${data.user.id}, creating profile via Prisma...`);
    
    try {
      // 2. Try to find a matching interpreter by email via Prisma
      const interpreter = await prisma.interpreter.findUnique({
        where: { emailCorporativo: email },
        select: { id: true }
      });

      console.log(`[AUTH_REGISTER] Linking to interpreter: ${interpreter?.id || 'none'}`);

      // 3. Upsert UserProfile record via Prisma
      await prisma.userProfile.upsert({
        where: { id: data.user.id },
        update: {
          email,
          displayName: name || email.split('@')[0],
          role: role,
          interpreterId: interpreter?.id ?? null,
        },
        create: {
          id: data.user.id,
          email,
          displayName: name || email.split('@')[0],
          role: role,
          interpreterId: interpreter?.id ?? null,
        }
      });
      
      console.log('[AUTH_REGISTER] Registration successful via Prisma');
    } catch (dbError: unknown) {
      const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown database error';
      console.error('[AUTH_REGISTER] Prisma error during profile creation:', errorMsg);
      return { 
        success: true, 
        role, 
        warning: 'Account created but profile linking had an issue. Please contact support.' 
      };
    }
  } else {
    console.warn('[AUTH_REGISTER] signUp returned no user and no error');
  }

  return { success: true, role };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  
  // Safe getUser call
  let user = null;
  try {
    const { data: { user: currentUser }, error } = await supabase.auth.getUser();
    if (!error) user = currentUser;
  } catch (_e) {
    // Silent fail
  }

  if (!user) return null;

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        role: true,
        interpreterId: true,
        displayName: true,
        termsAcceptedAt: true,
        signatureDate: true,
        bankName: true,
        bankAccount: true,
        bankAccountType: true,
        bankCedula: true,
        onboardingComplete: true,
        createdAt: true,
        interpreter: {
          select: {
            id: true,
            externalId: true,
            name: true,
            status: true,
            realtimeStatus: true,
            campaign: true,
            languageA: true,
            languageB: true,
            tariffPerMinute: true,
            emailCorporativo: true,
            pais: true,
            metodoPago: true,
            cuentaPago: true,
            documentosCompleto: true,
            notas: true,
            banco: true,
            tipoCuenta: true,
            cedulaRnc: true,
            updatedAt: true,
            createdAt: true,
          }
        } 
      }
    });

    if (!profile) {
      console.warn(`[AUTH] Profile not found in DB for user ${user.id}`);
      return null;
    }

    // Map Prisma model to UserProfile interface
    return {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      interpreter_id: profile.interpreterId,
      display_name: profile.displayName || '',
      terms_accepted_at: profile.termsAcceptedAt?.toISOString() || null,
      signature_date: profile.signatureDate?.toISOString() || null,
      bank_name: profile.bankName,
      bank_account: profile.bankAccount,
      bank_account_type: profile.bankAccountType,
      bank_cedula: profile.bankCedula,
      onboarding_complete: profile.onboardingComplete || false,
      created_at: profile.createdAt?.toISOString() || new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown database error';
    console.error('❌ AUTH: Prisma profile fetch failed:', errorMsg);
    return null;
  }
}


export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string;
  
  if (!email) {
    return { error: 'Email is required' };
  }

  const supabase = await createClient();
  
  // Robust origin detection for Server Actions
  const headersList = await (await import('next/headers')).headers();
  const forwardedHost = headersList.get('x-forwarded-host');
  const host = forwardedHost || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : headersList.get('origin') || '';

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error('[AUTH_RESET_REQUEST] Reset request failed:', error.message);
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || !confirmPassword) {
    return { error: 'Both password fields are required' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    console.error('[AUTH_UPDATE_PASSWORD] Password update failed:', error.message);
    return { error: error.message };
  }

  return { success: true };
}

