import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { applyRateLimit, createRateLimitHeaders, RATE_LIMITS } from '@/lib/security/rate-limit';

const db = prisma;

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(req, RATE_LIMITS.inviteValidation);
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult)
      }
    );
  }

  try {
    const { inviteCode } = await req.json();
    
    if (!inviteCode) {
      return NextResponse.json({ success: false, error: 'Invite code required' }, { status: 400 });
    }

    const access = await db.roleplayAccess.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
      include: { session: true },
    });

    if (!access) {
      return NextResponse.json({ success: false, error: 'Invalid or expired invitation' }, { status: 404 });
    }

    if (access.usedAt) {
      return NextResponse.json({ success: false, error: 'Invitation already used' }, { status: 400 });
    }

    if (access.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Invitation expired' }, { status: 400 });
    }

    const validInviteStates = ['DRAFT', 'INVITED', 'PENDING'];
    if (!validInviteStates.includes(access.session.status)) {
      return NextResponse.json({ success: false, error: 'Session no longer available' }, { status: 400 });
    }

    // Validate only - do NOT consume token
    // Token will be consumed when user actually starts the roleplay
    await db.roleplayAccess.update({
      where: { id: access.id },
      data: { validatedAt: new Date() },
    });

    return NextResponse.json(
      { 
        success: true, 
        data: { 
          sessionId: access.session.id,
          baseAudioUrl: access.session.baseAudioUrl,
        } 
      },
      { headers: createRateLimitHeaders(rateLimitResult) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Validate Invite By Code Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}