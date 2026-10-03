import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  // Delegate all routing decisions to the Entry Router
  redirect('/entry');
}