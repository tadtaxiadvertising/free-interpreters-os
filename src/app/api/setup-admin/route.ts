import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  try {
    console.log(`🚀 API SETUP: Promoting ${email} to admin...`);

    // 1. Find the user UUID in auth.users (Raw SQL as Prisma doesn't see auth schema by default)
    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM auth.users WHERE email = $1`, 
      email
    );

    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found in auth.users. Please sign up first.' }, { status: 404 });
    }

    const userId = users[0].id;

    // 2. Upsert the user profile as admin
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.user_profiles (id, role, display_name)
      VALUES ($1, 'admin', $2)
      ON CONFLICT (id) DO UPDATE SET role = 'admin'
    `, userId, email);

    return NextResponse.json({ 
      success: true, 
      message: `User ${email} promoted to admin.`,
      userId 
    });
  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
