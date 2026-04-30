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
const prisma = new PrismaClient({ adapter }) as any;

async function promote(email: string) {
  console.log(`🔍 Searching for user profile: ${email}...`);

  try {
    // 1. Find the user profile by email
    const profile = await prisma.userProfile.findUnique({
      where: { email }
    });

    if (!profile) {
      console.error(`❌ User profile with email ${email} not found. Make sure to sign up via Clerk first!`);
      return;
    }

    // 2. Update the role to admin
    await prisma.userProfile.update({
      where: { id: profile.id },
      data: { role: 'admin' }
    });

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
