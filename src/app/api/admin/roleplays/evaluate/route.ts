import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';

const db = prisma;

export async function POST(req: NextRequest) {
  try {
    const auth = await validateAction('admin');
    if ('error' in auth) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    const body = await req.json();
    const {
      sessionId,
      protocolScore,
      interpretationScore,
      languageScore,
      serviceScore,
      technicalScore,
      criticalError,
      comentarios,
    } = body;

    if (!sessionId || protocolScore === undefined || interpretationScore === undefined ||
        languageScore === undefined || serviceScore === undefined || technicalScore === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required scores' }, { status: 400 });
    }

    const scores = { protocolScore, interpretationScore, languageScore, serviceScore, technicalScore };
    for (const [key, value] of Object.entries(scores)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10) {
        return NextResponse.json({ success: false, error: `Invalid score for ${key}: must be 0-10` }, { status: 400 });
      }
    }

    const totalScore = criticalError
      ? 0
      : ((protocolScore * 0.35) +
         (interpretationScore * 0.40) +
         (languageScore * 0.15) +
         (serviceScore * 0.05) +
         (technicalScore * 0.05)) * 10;

    const actionRequired = criticalError || totalScore < 70
      ? 'Advertencia / Coaching'
      : totalScore < 85
        ? 'Feedback Requerido'
        : 'Ninguna';

    const result = await db.$transaction(async (tx) => {
      const session = await tx.roleplaySession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          qaScoreId: true,
          recordedAudioUrl: true,
          recruitmentCandidateId: true,
          interpreterId: true,
          status: true,
          evaluatorId: true,
        },
      });

      if (!session) throw new Error('Session not found');
      if (session.qaScoreId) throw new Error('Session already evaluated');
      if (!session.recordedAudioUrl) throw new Error('No response submitted yet');
      if (session.evaluatorId !== auth.user.userId) throw new Error('Not authorized to evaluate this session');

      await tx.roleplaySession.update({
        where: { id: sessionId },
        data: {
          evaluatorId: auth.user.userId,
          status: 'EVALUATED',
          evaluatedAt: new Date(),
        },
      });

      const qaScore = await tx.qAScore.create({
        data: {
          interpreterId: session.interpreterId ?? null,
          auditDate: new Date(),
          auditor: auth.user.email || 'System',
          protocolScore,
          interpretationScore,
          languageScore,
          serviceScore,
          technicalScore,
          totalScore,
          criticalError: Boolean(criticalError),
          comentarios: comentarios || '',
          accionRequerida: actionRequired,
        },
        select: { id: true, totalScore: true },
      });

      await tx.roleplaySession.update({
        where: { id: sessionId },
        data: { qaScoreId: qaScore.id },
      });

      if (session.recruitmentCandidateId) {
        await tx.recruitmentCandidate.update({
          where: { id: session.recruitmentCandidateId },
          data: { resultRoleplay: Math.round(totalScore) },
        });
      }

      return {
        qaScoreId: qaScore.id,
        totalScore: Math.round(totalScore * 100) / 100,
        actionRequired,
        interpreterId: session.interpreterId,
      };
    });

    if (result.interpreterId) {
      try {
        const interpreter = await db.interpreter.findUnique({
          where: { id: result.interpreterId },
          select: { emailCorporativo: true, name: true },
        });

        if (interpreter?.emailCorporativo) {
          const profile = await db.userProfile.findUnique({
            where: { email: interpreter.emailCorporativo },
            select: { id: true },
          });

          if (profile) {
            const scoreDisplay = result.totalScore.toFixed(1);
            await db.notification.create({
              data: {
                userId: profile.id,
                title: 'Roleplay Evaluado',
                message: `Tu roleplay "${interpreter.name}" fue evaluado: ${scoreDisplay}%. Acción: ${result.actionRequired}`,
                type: result.totalScore >= 85 ? 'success' : (result.totalScore >= 70 ? 'info' : 'warning'),
                link: '/dashboard/roleplays',
              },
            });
          }
        }
      } catch (notifyErr: unknown) {
        const message = notifyErr instanceof Error ? notifyErr.message : 'Unknown error';
        console.error('Notification failed but roleplay evaluation saved:', message);
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Evaluate Roleplay Error:', message);

    let status = 500;
    if (message.includes('not found')) status = 404;
    else if (message.includes('already evaluated') || message.includes('authorized')) status = 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
