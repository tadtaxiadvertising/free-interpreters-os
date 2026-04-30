import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/login');
  }

  const profile = await (prisma as any).userProfile.findFirst({
    where: { 
      OR: [
        { id: userId },
        { clerkId: userId }
      ]
    },
    select: { role: true }
  });

  redirect(profile?.role === 'admin' ? '/admin' : '/dashboard');
}
