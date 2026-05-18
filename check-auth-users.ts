import { createAdminClient } from './src/lib/supabase/admin';
import prismaClient from './src/lib/prisma';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const prisma = prismaClient;

async function check() {
  try {
    const supabaseAdmin = createAdminClient();
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      console.error('Error listing users:', error);
      return;
    }

    console.log('--- SUPABASE AUTH USERS ---');
    for (const u of users) {
      console.log(`Email: ${u.email} | ID: ${u.id}`);
    }

    console.log('\n--- POSTGRESQL USER PROFILES ---');
    const profiles = await prisma.userProfile.findMany();
    for (const p of profiles) {
      console.log(`Email: ${p.email} | ID: ${p.id} | Role: ${p.role}`);
    }
  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
