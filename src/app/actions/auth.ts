'use server';

import { createClient, isSupabaseConfigError } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { UserProfile, UserRole } from '@/lib/types';
import prismaClient from '@/lib/prisma';
import { z } from 'zod';

const prisma = prismaClient;

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * ACTION: User Login
 */
export async function login(formData: FormData) {
  const email = ((formData.get('email') as string) || '').toLowerCase().trim();
  const password = (formData.get('password') as string) || '';

  try {
    const validated = AuthSchema.parse({ email, password });
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword(validated);

    if (error) {
      console.error(`🔴 [AUTH_LOGIN] Failed for ${email}:`, error.message);
      return { success: false, error: 'Credenciales inválidas o error de autenticación.' };
    }

    // Fetch minimal profile via Prisma
    const profile = await prisma.userProfile.findUnique({
      where: { id: data.user.id },
      select: { role: true },
    });

    return { success: true, role: profile?.role || 'interpreter' };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return { success: false, error: 'Email o contraseña inválidos.' };
    }

    // Degradación Elegante: Controlamos el error de falta de variables sin crashear
    if (isSupabaseConfigError(err)) {
      console.warn('⚠️ [AUTH_LOGIN] Configuración de Supabase omitida.');
      return {
        success: false,
        error: 'El servicio de autenticación está temporalmente deshabilitado por falta de configuración.',
      };
    }

    // Atrapamos cualquier otro error interno real
    console.error('🔴 [AUTH_LOGIN] Unexpected error:', err);
    return { success: false, error: 'Error interno del sistema.' };
  }
}

/**
 * ACTION: User Registration
 */
export async function register(formData: FormData) {
  const email = ((formData.get('email') as string) || '').toLowerCase().trim();
  const password = (formData.get('password') as string) || '';
  const name = (formData.get('name') as string) || email.split('@')[0];
  const role = (formData.get('role') as string) || 'interpreter';

  try {
    const validated = AuthSchema.parse({ email, password });
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: { data: { display_name: name } },
    });

    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'No se pudo crear el usuario.' };

    // Sync Profile via Prisma
    const interpreter = await prisma.interpreter.findUnique({
      where: { emailCorporativo: email },
      select: { id: true },
    });

    await prisma.userProfile.upsert({
      where: { id: data.user.id },
      update: {
        email,
        displayName: name,
        role,
        interpreterId: interpreter?.id ?? null,
      },
      create: {
        id: data.user.id,
        email,
        displayName: name,
        role,
        interpreterId: interpreter?.id ?? null,
      },
    });

    return { success: true, role };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return { success: false, error: 'Datos de registro inválidos.' };

    if (isSupabaseConfigError(err)) {
      console.warn('⚠️ [AUTH_REGISTER] Configuración de Supabase omitida.');
      return {
        success: false,
        error: 'El servicio de registro está temporalmente deshabilitado por falta de configuración.',
      };
    }

    console.error('🔴 [AUTH_REGISTER] Error:', err);
    return { success: false, error: 'Error interno durante el registro.' };
  }
}

/**
 * ACTION: Get Current User Profile (Selective)
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profile = null;

    if (user) {
      profile = await prisma.userProfile.findUnique({
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
              tariffPerMinute: true,
              emailCorporativo: true,
            },
          },
        },
      });
    }

    if (!profile) return null;

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
    if (isSupabaseConfigError(error)) {
      console.warn('⚠️ [AUTH] Profile fetch omitido por falta de configuración.');
      return null;
    }
    console.error('🔴 [AUTH] Profile fetch failed:', error);
    return null;
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(formData: FormData) {
  const email = ((formData.get('email') as string) || '').toLowerCase().trim();
  if (!email) return { success: false, error: 'Email is required' };

  try {
    const headersList = await (await import('next/headers')).headers();
    const host = headersList.get('x-forwarded-host') || headersList.get('host');
    const proto = headersList.get('x-forwarded-proto') || 'https';
    const origin = host ? `${proto}://${host}` : '';

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      },
    });

    if (error) {
      console.error('🔴 [AUTH_RESET] Error generating link:', error.message);
      return { success: false, error: error.message };
    }

    console.log('\n======================================================');
    console.log('🔐 [ZERO-COST RECOVERY] PASSWORD RESET LINK GENERATED');
    console.log(`👤 User: ${email}`);
    console.log(`🔗 Link: ${data.properties?.action_link}`);
    console.log('======================================================\n');

    return { success: true };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('SUPABASE_SERVICE_ROLE_KEY') || err.message.includes('NEXT_PUBLIC_SUPABASE_URL'))
    ) {
      console.warn('⚠️ [AUTH_RESET] Request password omitido por falta de configuración.');
      return { success: false, error: 'Servicio deshabilitado temporalmente.' };
    }
    console.error('🔴 [AUTH_RESET] Unexpected error:', err);
    return { success: false, error: 'Error al solicitar el reset de contraseña.' };
  }
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!password || password !== confirmPassword) {
    return { success: false, error: 'Las contraseñas no coinciden o están vacías.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    if (isSupabaseConfigError(err)) {
      return { success: false, error: 'Servicio deshabilitado temporalmente.' };
    }
    return { success: false, error: 'Error al actualizar la contraseña.' };
  }
}
