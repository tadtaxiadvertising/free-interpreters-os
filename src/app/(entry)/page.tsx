import { resolveCurrentIdentity, resolveDestination } from '@/lib/identity/resolve-user';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EntryRouter() {
  const identity = await resolveCurrentIdentity();

  if (!identity) {
    redirect('/login');
  }

  // Resolve destination using centralized function
  const destination = resolveDestination(identity);
  redirect(destination);
}