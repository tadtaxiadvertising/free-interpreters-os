import 'dotenv/config';
import { createAdminClient } from '../src/lib/supabase/admin';

async function main() {
  const supabase = createAdminClient();
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error listing users:", error);
    return;
  }
  
  console.log("=== SUPABASE AUTH USERS ===");
  users.forEach(u => {
    console.log(`Email: ${u.email} | ID: ${u.id} | Metadata:`, u.user_metadata);
  });
}

main().catch(console.error);
