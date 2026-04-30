import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:sII7sq36zQ3wuRy@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
});

async function main() {
  console.log("Connecting to database using IPv4 pooler URL...");
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."user_profiles" DROP COLUMN IF EXISTS "clerk_id" CASCADE;');
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."user_profiles" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;');
    console.log("SUCCESS! Database schema updated successfully.");
  } catch (err) {
    console.error("Error updating database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
