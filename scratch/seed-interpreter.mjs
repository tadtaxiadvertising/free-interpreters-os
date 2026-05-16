/**
 * Seed: Create Supabase Auth user + UserProfile for interpreter access
 * Uses Supabase Admin API (service_role key) to create the auth user,
 * then Prisma to create the user_profiles record.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// ── Config ──────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

const EMAIL = 'deuryd@gmail.com';
const PASSWORD = 'Interpreter2026!';
const DISPLAY_NAME = 'Deuryd Interpreter';
const ROLE = 'interpreter';

// ── Supabase Admin Client ───────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Prisma Client ───────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: DIRECT_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`\n🔧 Creating Supabase Auth user: ${EMAIL}`);

  // Step 1: Create user in Supabase Auth (or get existing)
  // First check if user exists
  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  
  let userId;
  const existingUser = existingUsers?.users?.find(u => u.email === EMAIL);

  if (existingUser) {
    console.log(`✅ Supabase Auth user already exists: ${existingUser.id}`);
    userId = existingUser.id;
  } else {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // Auto-confirm email
      user_metadata: { display_name: DISPLAY_NAME },
    });

    if (createError) {
      console.error('❌ Failed to create Supabase Auth user:', createError.message);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`✅ Supabase Auth user created: ${userId}`);
  }

  // Step 2: Create/update UserProfile via Prisma
  console.log(`\n🔧 Creating UserProfile with role: ${ROLE}`);

  const profile = await prisma.userProfile.upsert({
    where: { id: userId },
    update: {
      email: EMAIL,
      displayName: DISPLAY_NAME,
      role: ROLE,
    },
    create: {
      id: userId,
      email: EMAIL,
      displayName: DISPLAY_NAME,
      role: ROLE,
      onboardingComplete: false,
    },
  });

  console.log(`✅ UserProfile created/updated!`);
  console.log(`   ID:      ${profile.id}`);
  console.log(`   Email:   ${profile.email}`);
  console.log(`   Role:    ${profile.role}`);
  console.log(`\n🔑 Login credentials:`);
  console.log(`   Email:    ${EMAIL}`);
  console.log(`   Password: ${PASSWORD}`);
  console.log(`\n🌐 Login URL: https://database-interpreters.rewvid.easypanel.host/login`);
  console.log(`⚠️  Change password after first login!`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ Error:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
