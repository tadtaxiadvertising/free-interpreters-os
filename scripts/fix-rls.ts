import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// IMPORTANT: Must use SERVICE_ROLE_KEY to bypass RLS and fix the policies
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ ERROR: Missing SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function fixRLSPolicies() {
  console.log('\n--- 🛠️  Supabase RLS Emergency Repair ---')
  
  const sqlCommands = [
    // 1. Enable RLS
    `ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;`,
    
    // 2. Drop problematic policies that cause recursion
    `DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;`,
    `DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;`,
    `DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.user_profiles;`,
    
    // 3. Create non-recursive Policy: Users can see ONLY their own profile
    // This is safe because it compares auth.uid() directly with the table ID
    `CREATE POLICY "view_own_profile" 
     ON public.user_profiles 
     FOR SELECT 
     USING (auth.uid() = id);`,
     
    // 4. Create non-recursive Policy: Users can update ONLY their own profile
    `CREATE POLICY "update_own_profile" 
     ON public.user_profiles 
     FOR UPDATE 
     USING (auth.uid() = id);`,

    // 5. Create Admin Policy: If we need a global admin check, we do it via a service-role 
    // or by checking the metadata in auth.users instead of public.user_profiles to avoid recursion.
    // For now, let's enable authenticated read to break the loop in development.
    `CREATE POLICY "allow_authenticated_read" 
     ON public.user_profiles 
     FOR SELECT 
     TO authenticated 
     USING (true);`
  ];

  console.log('📡 Executing SQL commands to repair policies...')

  for (const sql of sqlCommands) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.warn(`⚠️  Command failed: ${sql.substring(0, 50)}...`);
        console.warn(`Reason: ${error.message}`);
      } else {
        console.log(`✅ Success: ${sql.substring(0, 50)}...`);
      }
    } catch (err) {
      console.warn(`⚠️  Command failed: ${sql.substring(0, 50)}...`);
      console.warn(`Reason: RPC exec_sql not found. You might need to run this manually in the SQL Editor.`);
    }
  }

  console.log('\n--- 💡 IMPORTANT ---')
  console.log('If the commands above failed with "RPC not found", please copy-paste the following into your Supabase SQL Editor manually when you regain access:\n')
  console.log(sqlCommands.join('\n'))
  console.log('\n---------------------------------------\n')
}

fixRLSPolicies()
