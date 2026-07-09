import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase/admin';

async function main() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error("Error listing users:", error);
    return;
  }
  
  console.log("=== SUPABASE AUTH USERS ===");
  users.forEach((u: any) => {
    console.log(`Email: ${u.email} | ID: ${u.id} | Metadata:`, u.user_metadata);
  });
}

main().catch(console.error);
