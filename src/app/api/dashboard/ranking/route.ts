import { NextResponse } from 'next/server';
import { getCurrentActor, requireActor } from '@/lib/auth/current-actor';
import { getPrivateRankingSummary } from '@/lib/ranking/calculate';

export async function GET() {
  try {
    const actor = await getCurrentActor();
    const authed = requireActor(actor);

    if (authed.role !== 'interpreter' || !authed.interpreterId) {
      return NextResponse.json(
        { success: false, error: 'Only interpreters can access this endpoint' },
        { status: 403 }
      );
    }

    const summary = await getPrivateRankingSummary(authed.interpreterId);

    if (!summary) {
      return NextResponse.json(
        { success: false, error: 'Ranking data not available' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('[API] Private ranking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}