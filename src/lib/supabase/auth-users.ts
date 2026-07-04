import type { User } from '@supabase/supabase-js';
import {
  supabaseAdmin,
  isAdminUnavailableError,
} from '@/lib/supabase/admin';

import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseAdminClient = SupabaseClient;

export function normalizeAuthEmail(email: string) {
  return email.toLowerCase().trim();
}

export async function findAuthUserByEmail(
  supabaseAdmin: SupabaseAdminClient,
  email: string
): Promise<User | null> {
  const normalizedEmail = normalizeAuthEmail(email);
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const authUser = data.users.find(
      (user) => user.email?.toLowerCase() === normalizedEmail
    );

    if (authUser) return authUser;
    if (!data.nextPage || data.users.length === 0) return null;

    page = data.nextPage;
  }
}

/**
 * Confirm an existing Supabase Auth user's email.
 *
 * @throws {SupabaseAdminUnavailableError} when `SUPABASE_SERVICE_ROLE_KEY` is
 *   missing. Callers should handle this (or use `isAdminUnavailableError()`).
 */
export async function confirmAuthUserEmail(email: string): Promise<User | null> {
  try {
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);

    if (!existingUser) return null;
    if (existingUser.email_confirmed_at) return existingUser;

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      { email_confirm: true }
    );

    if (error) throw error;
    return data.user;
  } catch (error: unknown) {
    if (isAdminUnavailableError(error)) {
      throw error; // Let callers handle this semantic error
    }
    throw error;
  }
}

/**
 * Create or update a Supabase Auth user with a confirmed email.
 *
 * @throws {SupabaseAdminUnavailableError} when `SUPABASE_SERVICE_ROLE_KEY` is
 *   missing. Callers should handle this (or use `isAdminUnavailableError()`).
 */
export async function upsertConfirmedAuthUser(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User | null> {
  try {
    const email = normalizeAuthEmail(params.email);
    const existingUser = await findAuthUserByEmail(supabaseAdmin, email);
    const userMetadata = {
      ...(existingUser?.user_metadata ?? {}),
      display_name: params.displayName,
    };

    if (existingUser) {
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: params.password,
          email_confirm: true,
          user_metadata: userMetadata,
        }
      );

      if (error) throw error;
      return data.user;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: params.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) throw error;
    return data.user;
  } catch (error: unknown) {
    if (isAdminUnavailableError(error)) {
      throw error; // Let callers handle this semantic error
    }
    throw error;
  }
}
