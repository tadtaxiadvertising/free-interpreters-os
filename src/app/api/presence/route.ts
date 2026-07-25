import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/actions';
import prisma from '@/lib/prisma';
import { PresenceSchema } from '@/lib/api-schemas';
import { apiError, parseJsonBody } from '@/lib/api-responses';

const db = prisma;
const GRACE_PERIOD_MS = 30_000; // 30 seconds grace before marking offline

export async function POST(req: Request) {
  try {
    const userData = await getCurrentUser();

    if (!userData) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await parseJsonBody(req, PresenceSchema);
    const profile = userData.profile;
    const now = new Date();

    // ── HEARTBEAT ─────────────────────────────────────────────
    // Just update lastHeartbeat and lastActivity, no status change
    if (body.type === 'heartbeat') {
      if (profile?.interpreterId) {
        await db.interpreter.update({
          where: { id: profile.interpreterId },
          data: { lastHeartbeat: now, lastActivity: now },
          select: { id: true },
        });
      }
      return NextResponse.json({ success: true, heartbeat: true, ts: now.toISOString() });
    }

    // ── ONLINE ────────────────────────────────────────────────
    if (body.type === 'online') {
      if (!profile?.interpreterId) {
        return NextResponse.json({ success: true, skipped: true });
      }

      const interpreter = await db.interpreter.findUnique({
        where: { id: profile.interpreterId },
        select: { realtimeStatus: true, browserTabId: true },
      });

      const previousStatus = interpreter?.realtimeStatus || 'Offline';
      const tabId = body.tabId || crypto.randomUUID();

      await db.$transaction([
        db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            realtimeStatus: 'Online',
            statusReason: body.reason || 'login',
            lastOnlineAt: now,
            lastHeartbeat: now,
            lastActivity: now,
            statusChangedAt: now,
            browserTabId: tabId,
            clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
          },
          select: { id: true },
        }),
        db.interpreterStatusLog.create({
          data: {
            interpreterId: profile.interpreterId,
            previousStatus,
            newStatus: 'Online',
            reason: body.reason || 'login',
            changedBy: 'interpreter',
            metadata: { tabId, clientIp: req.headers.get('x-forwarded-for') || null },
          },
        }),
      ]);

      return NextResponse.json({ success: true, status: 'Online', tabId });
    }

    // ── OFFLINE (tab closed / logout) ────────────────────────
    if (body.type === 'offline') {
      if (!profile?.interpreterId) {
        return NextResponse.json({ success: true, skipped: true });
      }

      const interpreter = await db.interpreter.findUnique({
        where: { id: profile.interpreterId },
        select: { realtimeStatus: true, browserTabId: true },
      });

      // Grace period: if another tab is still active, don't mark offline
      if (interpreter?.browserTabId && body.tabId && interpreter.browserTabId !== body.tabId) {
        return NextResponse.json({ success: true, keptActive: true });
      }

      const previousStatus = interpreter?.realtimeStatus || 'Online';
      const reason = body.reason || 'browser_closed';

      await db.$transaction([
        db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            realtimeStatus: 'Offline',
            statusReason: reason,
            lastOfflineAt: now,
            statusChangedAt: now,
            browserTabId: null,
          },
          select: { id: true },
        }),
        db.interpreterStatusLog.create({
          data: {
            interpreterId: profile.interpreterId,
            previousStatus,
            newStatus: 'Offline',
            reason,
            changedBy: 'system',
            metadata: { tabId: body.tabId || null, reason },
          },
        }),
      ]);

      return NextResponse.json({ success: true, status: 'Offline' });
    }

    // ── STATUS CHANGE (away, busy, etc.) ─────────────────────
    if (body.type === 'status_change') {
      if (!profile?.interpreterId) {
        return NextResponse.json({ success: true, skipped: true });
      }

      const { status } = body;
      const interpreter = await db.interpreter.findUnique({
        where: { id: profile.interpreterId },
        select: { realtimeStatus: true },
      });
      const previousStatus = interpreter?.realtimeStatus || 'Offline';

      await db.$transaction([
        db.interpreter.update({
          where: { id: profile.interpreterId },
          data: {
            realtimeStatus: status,
            statusReason: body.reason || 'manual',
            lastActivity: now,
            statusChangedAt: now,
            ...(status === 'Online' ? { lastOnlineAt: now } : {}),
            ...(status === 'Offline' ? { lastOfflineAt: now } : {}),
          },
          select: { id: true },
        }),
        db.interpreterStatusLog.create({
          data: {
            interpreterId: profile.interpreterId,
            previousStatus,
            newStatus: status,
            reason: body.reason || 'manual',
            changedBy: 'interpreter',
            metadata: { tabId: body.tabId || null },
          },
        }),
      ]);

      return NextResponse.json({ success: true, status });
    }

    return NextResponse.json({ success: false, error: 'Unknown presence type' }, { status: 400 });
  } catch (error) {
    return apiError({ error, fallback: 'Internal Server Error' });
  }
}

/**
 * GET: returns a heartbeat ping for the current interpreter (lightweight)
 */
export async function GET(req: Request) {
  try {
    const userData = await getCurrentUser();
    if (!userData?.profile?.interpreterId) {
      return NextResponse.json({ online: false });
    }

    const interpreter = await db.interpreter.findUnique({
      where: { id: userData.profile.interpreterId },
      select: {
        realtimeStatus: true,
        lastHeartbeat: true,
        statusChangedAt: true,
        statusReason: true,
      },
    });

    if (!interpreter) {
      return NextResponse.json({ online: false });
    }

    const now = Date.now();
    const heartbeatAge = interpreter.lastHeartbeat
      ? now - new Date(interpreter.lastHeartbeat).getTime()
      : Infinity;

    return NextResponse.json({
      online: interpreter.realtimeStatus !== 'Offline',
      status: interpreter.realtimeStatus,
      heartbeatAgeMs: heartbeatAge,
      heartbeatAgeSeconds: Math.round(heartbeatAge / 1000),
      statusReason: interpreter.statusReason,
      statusChangedAt: interpreter.statusChangedAt?.toISOString(),
    });
  } catch {
    return NextResponse.json({ online: false }, { status: 500 });
  }
}