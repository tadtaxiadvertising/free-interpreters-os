import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import { createRoleplaySession } from '@/app/actions/roleplay';

const db = prisma;

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 403 });

    const formData = await req.formData();
    const baseAudio = formData.get('baseAudio') as File;
    const participantType = formData.get('participantType') as string;
    const participantId = formData.get('participantId') as string;

    if (!baseAudio || !participantType || !participantId) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Upload base audio to Supabase first
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const session = await db.roleplaySession.create({
      data: {
        interpreterId: participantType === 'interpreter' ? parseInt(participantId) : null,
        recruitmentCandidateId: participantType === 'candidate' ? parseInt(participantId) : null,
        baseAudioUrl: '', // placeholder
        status: 'PENDING',
      },
      select: { id: true },
    });

    const extension = baseAudio.name.split('.').pop() || 'webm';
    const basePath = `base/${session.id}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('roleplay-audio')
      .upload(basePath, baseAudio, { contentType: baseAudio.type });

    if (uploadError) {
      await db.roleplaySession.delete({ where: { id: session.id } });
      return NextResponse.json({ success: false, error: 'Failed to upload audio' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('roleplay-audio')
      .getPublicUrl(basePath);

    await db.roleplaySession.update({
      where: { id: session.id },
      data: { baseAudioUrl: publicUrl },
    });

    let inviteLink = `${process.env.FRONTEND_ORIGIN || 'https://freeinterpreters.com'}/roleplays/${session.id}`;

    if (participantType === 'candidate') {
      const { randomBytes, createHash } = await import('crypto');
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.roleplayAccess.create({
        data: {
          sessionId: session.id,
          tokenHash,
          expiresAt,
        },
      });

      inviteLink = `${process.env.FRONTEND_ORIGIN || 'https://freeinterpreters.com'}/roleplays/invite/${rawToken}`;
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        sessionId: session.id,
        inviteLink,
      } 
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create Roleplay API Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 403 });

    const sessions = await db.roleplaySession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        interpreter: { select: { id: true, name: true, externalId: true, emailCorporativo: true } },
        recruitmentCandidate: { select: { id: true, name: true, email: true } },
        qaScore: { select: { id: true, totalScore: true, criticalError: true } },
      },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get Roleplays Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}