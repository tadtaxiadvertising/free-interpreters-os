import { revalidatePath } from 'next/cache';

/**
 * Revalidates every page that can display interpreter profile data or records
 * derived from that profile (production logs, payroll, rankings, calendars,
 * dashboards, and admin rosters).
 */
export function revalidateInterpreterProfileRecords(interpreterId?: number | null) {
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');
  revalidatePath('/interpreters');
  revalidatePath('/production');
  revalidatePath('/payroll');
  revalidatePath('/dashboard/earnings');
  revalidatePath('/dashboard/ranking');
  revalidatePath('/dashboard/calendar');
  revalidatePath('/admin/calendar');
  revalidatePath('/admin/payrates');
  revalidatePath('/admin/users');

  if (interpreterId) {
    revalidatePath(`/interpreters/${interpreterId}`);
    revalidatePath(`/interpreters/${interpreterId}/compliance`);
  }
}
