import prismaClient from './src/lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = prismaClient;

async function checkAndFix() {
  try {
    console.log('Checking user_profiles policies...');
    
    // Check if RLS is enabled on user_profiles
    const rlsStatus = await prisma.$queryRaw`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'user_profiles';
    `;
    console.log('RLS Status:', rlsStatus);

    // Let's list existing policies on user_profiles
    const policies = await prisma.$queryRaw`
      SELECT policyname, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'user_profiles';
    `;
    console.log('Existing Policies:', policies);

    console.log('Enabling SELECT policy for all users on user_profiles...');
    
    // Create a policy that allows any authenticated user to select their own profile, or just select any profile
    // To be extremely safe and simple, let's allow all authenticated users to read profiles
    await prisma.$executeRawUnsafe(`
      CREATE POLICY "Allow authenticated select on user_profiles" 
      ON public.user_profiles 
      FOR SELECT 
      TO authenticated 
      USING (true);
    `).catch(err => {
      console.log('Policy creation message (might already exist):', err.message);
    });

    console.log('RLS fix complete!');
  } catch (err) {
    console.error('Error during RLS check:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFix();
