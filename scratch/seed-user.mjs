/**
 * Seed script: Create RbacUser for deuryd@gmail.com
 * Uses DIRECT_URL (port 5432) for direct connection instead of PgBouncer
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// Use DIRECT_URL for seed operations (bypasses PgBouncer)
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
console.log(`Connecting to: ${connectionString?.replace(/:[^:@]+@/, ':***@')}`);

const pool = new pg.Pool({
  connectionString,
  max: 2,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'deuryd@gmail.com';
  const password = 'Admin2026!';
  const name = 'Deuryd Admin';
  const role = 'ADMIN';

  // Check if user already exists
  const existing = await prisma.rbacUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`✅ User already exists: ${email} (role: ${existing.role})`);
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // Hash password (12 rounds)
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.rbacUser.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
    },
  });

  console.log(`✅ User created successfully!`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Name:     ${user.name}`);
  console.log(`   Role:     ${user.role}`);
  console.log(`   ID:       ${user.id}`);
  console.log(`\n🔑 Temporary password: ${password}`);
  console.log(`⚠️  Change this password after first login!`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌ Error creating user:', e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
