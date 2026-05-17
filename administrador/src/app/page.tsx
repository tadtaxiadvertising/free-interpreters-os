import { auth } from "@/lib/auth-rbac";
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/portal-rbac/login');
  }

  const role = (session.user as any).role;
  if (role === 'INTERPRETER') {
    redirect('/portal-rbac/interpreter/dashboard');
  } else if (role === 'ADMIN') {
    redirect('/portal-rbac/admin/dashboard');
  } else if (role === 'HOLDER') {
    redirect('/portal-rbac/holder/dashboard');
  } else {
    redirect('/portal-rbac/login');
  }
}
