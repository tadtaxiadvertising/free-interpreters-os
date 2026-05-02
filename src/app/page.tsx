import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import prismaClient from '@/lib/prisma';

const prisma = prismaClient as any;

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use Prisma for profile lookup to avoid internal fetch/DNS issues
  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { role: true }
  });

  redirect(profile?.role === 'admin' ? '/admin' : '/dashboard');
}

