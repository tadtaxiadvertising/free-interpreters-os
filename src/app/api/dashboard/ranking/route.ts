import { NextResponse } from 'next/server';
import { getCurrentActor, requireActor } from '@/lib/auth/current-actor';
import { getInterpreterMetrics, getLeaderboard } from '@/services/metrics/metrics-service';

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

    // Get current interpreter metrics from materialized view
    const metrics = await getInterpreterMetrics(authed.interpreterId);
    
    if (!metrics) {
      return NextResponse.json(
        { success: false, error: 'Ranking data not available - metrics not calculated yet' },
        { status: 404 }
      );
    }

    // Get top 10 leaderboard for context
    const leaderboard = await getLeaderboard(undefined, 10);

    return NextResponse.json({ 
      success: true, 
      data: {
        ...metrics,
        leaderboard: leaderboard.map((l, i) => ({
          position: i + 1,
          name: l.name,
          minutes: l.interpretedMinutes,
          qaScore: l.qaScore,
        })),
        myPosition: metrics.rankingPosition,
        myMinutes: metrics.interpretedMinutes,
        myQaScore: metrics.qaScore,
      }
    });
  } catch (error) {
    console.error('[API] Private ranking error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}