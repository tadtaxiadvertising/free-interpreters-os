import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;
const MAX_AUDIO_SIZE = 15 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) return NextResponse.json({ success: false, error: auth.error }, { status: 403 });

    const formData = await req.formData();
    const baseAudio = formData.get('baseAudio');
    const participantType = formData.get('participantType');
    const participantId = formData.get('participantId');

    if (!(baseAudio instanceof File) || typeof participantType !== 'string' || typeof participantId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (participantType !== 'interpreter' && participantType !== 'candidate') {
      return NextResponse.json({ success: false, error: 'Invalid participant type' }, { status: 400 });
    }

    const parsedParticipantId = Number.parseInt(participantId, 10);
    if (!Number.isSafeInteger(parsedParticipantId) || parsedParticipantId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid participant ID' }, { status: 400 });
    }

    if (baseAudio.size <= 0 || baseAudio.size > MAX_AUDIO_SIZE) {
      return NextResponse.json({ success: false, error: 'Audio must be between 1 byte and 15 MB' }, { status: 400 });
    }
    if (!ALLOWED_AUDIO_TYPES.has(baseAudio.type)) {
      return NextResponse.json({ success: false, error: `Audio type ${baseAudio.type || 'unknown'} not allowed` }, { status: 400 });
    }

    if (participantType === 'interpreter') {
      const interpreter = await db.interpreter.findUnique({ where: { id: parsedParticipantId }, select: { id: true } });
      if (!interpreter) return NextResponse.json({ success: false, error: 'Interpreter not found' }, { status: 404 });
    } else {
      const candidate = await db.recruitmentCandidate.findUnique({ where: { id: parsedParticipantId }, select: { id: true } });
      if (!candidate) return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Storage is not configured' }, { status: 503 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const session = await db.roleplaySession.create({
      data: {
        interpreterId: participantType === 'interpreter' ? parsedParticipantId : null,
        recruitmentCandidateId: participantType === 'candidate' ? parsedParticipantId : null,
        baseAudioUrl: '',
        status: 'DRAFT',
      },
      select: { id: true },
    });

    const extension = baseAudio.name.split('.').pop()?.toLowerCase() || 'webm';
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

    const origin = process.env.FRONTEND_ORIGIN || 'https://freeinterpreters.com';
    let inviteLink = `${origin}/roleplays/${session.id}`;

    if (participantType === 'candidate') {
      const { randomBytes, createHash } = await import('crypto');
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Generate short invite code (8 chars alphanumeric)
      const inviteCode = randomBytes(4).toString('base64url').slice(0, 8).toUpperCase();

      await db.roleplayAccess.create({
        data: { sessionId: session.id, tokenHash, inviteCode, expiresAt },
      });

      const origin = process.env.FRONTEND_ORIGIN || 'https://freeinterpreters.com';
      inviteLink = `${origin}/r/${inviteCode}`;
    }

    return NextResponse.json({
      success: true,
      data: { sessionId: session.id, inviteLink },
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
