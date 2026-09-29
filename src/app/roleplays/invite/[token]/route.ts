import crypto from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const tokenHash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await prisma.roleplayAccess.findFirst({ where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() }, session: { status: 'PENDING' } }, select: { id: true, sessionId: true } });
  if (!access) return new NextResponse('El enlace de roleplay no es válido o ya expiró.', { status: 404 });
  await prisma.roleplayAccess.update({ where: { id: access.id }, data: { usedAt: new Date() } });
  const response = NextResponse.redirect(new URL(`/roleplays/${access.sessionId}`, _request.url));
  response.cookies.set('roleplay_access', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 7, path: '/roleplays' });
  return response;
}
