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
 * GET WORKDAY ROSTER — includes today's production metrics per interpreter
 */
export async function getWorkdayRosterAction(): Promise<ActionResult<WorkdayInterpreter[]>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const interpreters = await db.interpreter.findMany({
      where: { status: 'Activo' },
      select: {
        id: true,
        name: true,
        externalId: true,
        campaign: true,
        status: true,
        realtimeStatus: true,
        lastHeartbeat: true,
        lastActivity: true,
        lastOnlineAt: true,
        lastOfflineAt: true,
        statusChangedAt: true,
        statusReason: true,
        tariffPerMinute: true,
        productionLogs: {
          where: {
            date: { gte: today, lte: todayEnd },
          },
          select: {
            id: true,
            connectedHours: true,
            interpretedMinutes: true,
            callsAttended: true,
            adherence: true,
            loginTime: true,
            logoutTime: true,
            campaign: true,
            status: true,
          },
          take: 1,
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result: WorkdayInterpreter[] = interpreters.map((i) => {
      const log = i.productionLogs?.[0] || null;
      const connectedHours = log ? Number(log.connectedHours || 0) : 0;
      const interpretedMinutes = log?.interpretedMinutes || 0;
      const callsAttended = log?.callsAttended || 0;
      const adherence = log ? Number(log.adherence || 0) : null;
      const loginTime = log?.loginTime || null;
      const logoutTime = log?.logoutTime || null;
      const logCampaign = log?.campaign || null;

      // Workday classification
      const isOnline = i.realtimeStatus === 'Online';
      const isBusy = i.realtimeStatus === 'Busy';
      const isAway = i.realtimeStatus === 'Away';
      const isOffline = i.realtimeStatus === 'Offline';
      const hasLoggedIn = !!log;
      const hasLogout = !!logoutTime;

      let workdayStatus: string;
      if (isBusy) workdayStatus = 'En llamada';
      else if (isOnline && hasLoggedIn && !hasLogout) workdayStatus = 'Activo';
      else if (isOnline && hasLoggedIn && hasLogout) workdayStatus = 'Disponible';
      else if (isAway && hasLoggedIn) workdayStatus = 'En pausa';
      else if (isOffline && hasLoggedIn) workdayStatus = 'Desconectado (laboró)';
      else if (isOnline && !hasLoggedIn) workdayStatus = 'Online sin registro';
      else workdayStatus = 'Sin actividad hoy';

      return {
        id: i.id,
        name: i.name,
        externalId: i.externalId,
        campaign: logCampaign || i.campaign,
        realtimeStatus: i.realtimeStatus || 'Offline',
        lastHeartbeat: i.lastHeartbeat,
        lastActivity: i.lastActivity,
        lastOnlineAt: i.lastOnlineAt,
        lastOfflineAt: i.lastOfflineAt,
        statusChangedAt: i.statusChangedAt,
        statusReason: i.statusReason,
        tariffPerMinute: Number(i.tariffPerMinute),
        // Workday metrics
        connectedHours,
        interpretedMinutes,
        callsAttended,
        adherence,
        loginTime,
        logoutTime,
        workdayStatus,
        hasProductionLog: !!log,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[Monitoring] Workday roster fetch failed:', error);
    return { success: false, error: 'Failed to load workday roster', code: 'INTERNAL_ERROR' };
  }
}

export interface WorkdayInterpreter {
  id: number;
  name: string;
  externalId: string;
  campaign: string | null;
  realtimeStatus: string;
  lastHeartbeat: Date | null;
  lastActivity: Date | null;
  lastOnlineAt: Date | null;
  lastOfflineAt: Date | null;
  statusChangedAt: Date | null;
  statusReason: string | null;
  tariffPerMinute: number;
  // Workday metrics
  connectedHours: number;
  interpretedMinutes: number;
  callsAttended: number;
  adherence: number | null;
  loginTime: Date | null;
  logoutTime: Date | null;
  workdayStatus: string;
  hasProductionLog: boolean;
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