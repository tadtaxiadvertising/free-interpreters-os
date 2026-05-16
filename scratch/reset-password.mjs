/**
 * Reset password for existing Supabase user
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EMAIL = 'deuryd@gmail.com';
const NEW_PASSWORD = 'Interpreter2026!';

async function main() {
  // Find user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === EMAIL);
  
  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`);
    process.exit(1);
  }

  // Update password
  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
  });

  if (error) {
    console.error('❌ Failed to update password:', error.message);
    process.exit(1);
  }

  console.log(`✅ Password updated for ${EMAIL}`);
  console.log(`🔑 New password: ${NEW_PASSWORD}`);
  console.log(`🌐 Login at: https://database-interpreters.rewvid.easypanel.host/login`);
}

main();
