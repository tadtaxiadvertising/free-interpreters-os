import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // We execute the raw SQL to alter the user_profiles table.
    // This removes the clerk dependency and adds the native auth column.
    
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."user_profiles" DROP COLUMN IF EXISTS "clerk_id" CASCADE;');
    await prisma.$executeRawUnsafe('ALTER TABLE "public"."user_profiles" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;');

    return NextResponse.json({ success: true, message: "Database schema successfully updated for native authentication." });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
}
