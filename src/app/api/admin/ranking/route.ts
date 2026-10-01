import { NextResponse } from 'next/server';
import { getCurrentActor, requireActor, requireRole } from '@/lib/auth/current-actor';
import { getAdminLeaderboard } from '@/lib/ranking/calculate';

export async function GET() {
  try {
    const actor = await getCurrentActor();
    const authed = requireRole(requireActor(actor), ['admin']);

    const leaderboard = await getAdminLeaderboard();

    return NextResponse.json({ success: true, data: leaderboard });
  } catch (error) {
    console.error('[API] Admin ranking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}