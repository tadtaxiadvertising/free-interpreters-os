import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

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

export async function confirmAuthUserEmail(email: string): Promise<User | null> {
  const supabaseAdmin = createAdminClient();
  const existingUser = await findAuthUserByEmail(supabaseAdmin, email);

  if (!existingUser) return null;
  if (existingUser.email_confirmed_at) return existingUser;

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    existingUser.id,
    { email_confirm: true }
  );

  if (error) throw error;
  return data.user;
}

export async function upsertConfirmedAuthUser(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User | null> {
  const supabaseAdmin = createAdminClient();
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
}
