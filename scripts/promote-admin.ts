import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Load .env variables
try {
  process.loadEnvFile();
} catch (e) {}

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new pg.Pool({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function promote(email: string) {
  console.log(`🔍 Searching for user: ${email}...`);

  try {
    // 1. Find user ID in auth.users
    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM auth.users WHERE email = $1`, 
      email
    );

    if (users.length === 0) {
      console.error(`❌ User with email ${email} not found in auth.users. Make sure to sign up first!`);
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Found User ID: ${userId}`);

    // 2. Update role in user_profiles
    await prisma.$executeRawUnsafe(
      `UPDATE public.user_profiles SET role = 'admin' WHERE id = $1`,
      userId
    );

    console.log(`🚀 SUCCESS: ${email} has been promoted to ADMIN.`);
  } catch (err) {
    console.error('❌ Promotion failed:');
    console.error(err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const targetEmail = process.argv[2] || 'ary.rosario19@gmail.com';
promote(targetEmail);
