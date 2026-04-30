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
    const db = prisma as any;

    // 1. Find the user profile by email
    const profile = await db.userProfile.findUnique({
      where: { email }
    });

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found. Please sign up via Clerk first.' }, { status: 404 });
    }

    // 2. Update the role to admin
    await db.userProfile.update({
      where: { id: profile.id },
      data: { role: 'admin' }
    });

    return NextResponse.json({ 
      success: true, 
      message: `User ${email} promoted to admin.`,
      clerkId: profile.clerkId 
    });
  } catch (error: any) {
    console.error('❌ Setup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
