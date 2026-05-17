import { getCurrentUser } from '@/lib/auth/actions';
import { redirect } from 'next/navigation';
import prismaClient from '@/lib/prisma';

const prisma = prismaClient;

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const userData = await getCurrentUser();

  if (!userData) {
    redirect('/login');
  }

  const role = userData.profile?.role;

  if (role === 'admin') {
    redirect('/admin');
  } else if (role === 'holder') {
    redirect('/portal-rbac/holder/dashboard');
  } else {
    redirect('/dashboard');
  }
}

