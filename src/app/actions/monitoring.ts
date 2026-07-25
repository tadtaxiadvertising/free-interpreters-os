'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import { MonitoringFilterSchema } from '@/lib/validators/monitoring';
import type { MonitoredInterpreter } from '@/lib/validators/monitoring';
import type { ActionResult } from '@/lib/types';

const db = prisma;

export async function getLiveRosterAction(
  filters: unknown
): Promise<ActionResult<MonitoredInterpreter[]>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const validated = MonitoringFilterSchema.parse(filters);

    const where: Record<string, unknown> = { status: 'Activo' };

    if (validated.search?.trim()) {
      const term = validated.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { externalId: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (validated.campaign?.trim()) {
      where.campaign = validated.campaign.trim();
    }

    // Filter by realtime status if provided
    if (validated.realtimeStatus?.trim()) {
      where.realtimeStatus = validated.realtimeStatus.trim();
    }

    const interpreters = await db.interpreter.findMany({
      where,
      select: {
        id: true,
        name: true,
        externalId: true,
        campaign: true,
        status: true,
        realtimeStatus: true,
        lastHeartbeat: true,
        lastActivity: true,
        statusChangedAt: true,
        statusReason: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: interpreters as unknown as MonitoredInterpreter[] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Invalid filter parameters',
        code: 'VALIDATION_ERROR',
      };
    }
    console.error('[Monitoring] Roster fetch failed:', error);
    return { success: false, error: 'Failed to load live roster', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Admin override: force-set an interpreter's realtime status
 */
export async function adminOverrideStatus(
  interpreterId: number,
  newStatus: string,
  reason?: string
): Promise<ActionResult<{ status: string }>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const interpreter = await db.interpreter.findUnique({ where: { id: interpreterId } });
    if (!interpreter) {
      return { success: false, error: 'Interpreter not found', code: 'NOT_FOUND' };
    }

    const previousStatus = interpreter.realtimeStatus || 'Offline';
    const now = new Date();

    await db.$transaction([
      db.interpreter.update({
        where: { id: interpreterId },
        data: {
          realtimeStatus: newStatus,
          statusReason: reason || 'admin_override',
          statusChangedAt: now,
          ...(newStatus === 'Online' ? { lastOnlineAt: now } : {}),
          ...(newStatus === 'Offline' ? { lastOfflineAt: now } : {}),
        },
      }),
      db.interpreterStatusLog.create({
        data: {
          interpreterId,
          previousStatus,
          newStatus,
          reason: reason || 'admin_override',
          changedBy: 'admin',
          metadata: { adminId: auth.profile?.id },
        },
      }),
    ]);

    return { success: true, data: { status: newStatus } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin] Status override failed:', message);
    return { success: false, error: 'Failed to update status', code: 'INTERNAL_ERROR' };
  }
}