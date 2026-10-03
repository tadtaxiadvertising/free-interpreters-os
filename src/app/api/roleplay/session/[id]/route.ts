import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveCurrentIdentity } from '@/lib/identity/resolve-user';
import { applyRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/security/rate-limit';

const db = prisma;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = applyRateLimit(req, RATE_LIMITS.sessionAccess);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { id } = await params;

    // Resolve current identity
    const identity = await resolveCurrentIdentity();
    if (!identity) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.roleplaySession.findUnique({
      where: { id },
      select: {
        id: true,
        baseAudioUrl: true,
        recordedAudioUrl: true,
        status: true,
        interpreterId: true,
        recruitmentCandidateId: true,
        access: { select: { tokenHash: true, usedAt: true, validatedAt: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // Ownership check
    const hasAccess = await checkSessionAccess(identity, session);
    if (!hasAccess) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // For candidates, only return base audio if token is validated
    let baseAudioUrl: string | null = session.baseAudioUrl;
    let recordedAudioUrl: string | null = session.recordedAudioUrl;

    if (identity.role !== 'admin' && session.recruitmentCandidateId) {
      const hasValidToken = session.access?.validatedAt && !session.access.usedAt;
      if (!hasValidToken) {
        baseAudioUrl = null;
        recordedAudioUrl = null;
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        data: {
          id: session.id,
          baseAudioUrl,
          recordedAudioUrl,
          status: session.status,
        }
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get Session Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function checkSessionAccess(identity: Awaited<ReturnType<typeof resolveCurrentIdentity>> | null, session: {
  interpreterId: number | null;
  recruitmentCandidateId: number | null;
  status: string;
}): Promise<boolean> {
  if (!identity) return false;
  // Admin has access to all sessions
  if (identity.role === 'admin') return true;

  // Check interpreter ownership
  if (session.interpreterId && identity.interpreterId === session.interpreterId) return true;

  // Check candidate access via valid token
  if (session.recruitmentCandidateId) {
    // For candidates, they must have a valid session cookie/token
    // The token validation happens in the invite/start flow
    // Here we just verify the session is in a valid state for candidate access
    return ['STARTED', 'IN_PROGRESS'].includes(session.status);
  }

  return false;
}