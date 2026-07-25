'use server';

import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import type { ActionResult } from '@/lib/types';

const db = prisma;

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'status' | 'payroll' | 'qa' | 'system' | 'fleet';

export interface Alert {
  id: string;
  title: string;
  message: string;
  type: AlertSeverity;
  category: AlertCategory;
  isRead: boolean;
  link: string | null;
  createdAt: Date;
}

/**
 * ACTION: Fetch active (unread or recent) alerts for admin
 */
export async function getAlerts(
  includeRead = false,
  limit = 50
): Promise<ActionResult<Alert[]>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    const alerts = await db.notification.findMany({
      where: includeRead ? {} : { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        link: true,
        createdAt: true,
      },
    }) as Alert[];

    return { success: true, data: alerts };
  } catch (error) {
    console.error('[Alerts] Fetch failed:', error);
    return { success: false, error: 'Failed to fetch alerts', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Mark an alert as read
 */
export async function dismissAlert(alertId: string): Promise<ActionResult<null>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    await db.notification.update({
      where: { id: alertId },
      data: { isRead: true },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error('[Alerts] Dismiss failed:', error);
    return { success: false, error: 'Failed to dismiss alert', code: 'INTERNAL_ERROR' };
  }
}

/**
 * ACTION: Dismiss all alerts at once
 */
export async function dismissAllAlerts(): Promise<ActionResult<null>> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { success: false, error: auth.error, code: auth.code };

  try {
    await db.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return { success: true, data: null };
  } catch (error) {
    console.error('[Alerts] Dismiss all failed:', error);
    return { success: false, error: 'Failed to dismiss alerts', code: 'INTERNAL_ERROR' };
  }
}

/**
 * Server-side: Create an alert (used internally by anomaly detectors)
 */
export async function createAlert(params: {
  title: string;
  message: string;
  type: AlertSeverity;
  category: AlertCategory;
  link?: string;
  userId?: string;
}): Promise<string | null> {
  try {
    const alert = await db.notification.create({
      data: {
        title: params.title,
        message: params.message,
        type: params.type,
        category: params.category,
        link: params.link || null,
        userId: params.userId || null,
      },
      select: { id: true },
    });
    return alert.id;
  } catch (error) {
    console.error('[Alerts] Create failed:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// ANOMALY DETECTORS
// ─────────────────────────────────────────────────────────────

/**
 * Detect interpreters who are:
 * - Offline for >30 min during working hours (Mon-Fri, 8am-6pm Santo Domingo)
 * - Busy without an active call session
 * - Away for >2 hours
 */
export async function detectAnomalies(): Promise<{
  offlineLong: number;
  busyNoCall: number;
  awayLong: number;
}> {
  const auth = await validateAction('admin');
  if ('error' in auth) return { offlineLong: 0, busyNoCall: 0, awayLong: 0 };

  try {
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Check if within working hours (Santo Domingo timezone)
    const sdNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santo_Domingo' }));
    const day = sdNow.getDay();
    const hour = sdNow.getHours();
    const isWorkingHours = day >= 1 && day <= 5 && hour >= 8 && hour < 18;

    let offlineLong = 0;
    let busyNoCall = 0;
    let awayLong = 0;

    if (isWorkingHours) {
      // 1. Offline > 30 min during working hours
      const offlineInterpreters = await db.interpreter.findMany({
        where: {
          realtimeStatus: 'Offline',
          statusChangedAt: { lt: thirtyMinAgo },
          status: 'Activo',
        },
        select: { id: true, name: true, externalId: true, lastOfflineAt: true },
      });

      for (const interp of offlineInterpreters) {
        const existingAlert = await db.notification.findFirst({
          where: {
            title: { contains: interp.name },
            type: 'critical',
            isRead: false,
          },
        });

        if (!existingAlert) {
          const lastSeen = interp.lastOfflineAt
            ? ` desde ${interp.lastOfflineAt.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}`
            : '';
          await createAlert({
            title: `🔴 ${interp.name} offline prolongado`,
            message: `${interp.name} (${interp.externalId}) lleva más de 30 min offline${lastSeen}.`,
            type: 'critical',
            category: 'status',
            link: `/admin/monitoring`,
          });
        }
        offlineLong++;
      }

      // 2. Busy without active call session
      const busyInterpreters = await db.interpreter.findMany({
        where: {
          realtimeStatus: 'Busy',
          status: 'Activo',
        },
        select: {
          id: true,
          name: true,
          externalId: true,
          callSessions: { where: { endedAt: null }, select: { id: true }, take: 1 },
        },
      });

      for (const interp of busyInterpreters) {
        if (interp.callSessions.length === 0) {
          // Auto-remediate: set to Online since there's no active call
          await db.$transaction([
            db.interpreter.update({
              where: { id: interp.id },
              data: {
                realtimeStatus: 'Online',
                statusReason: 'auto_remediated',
                statusChangedAt: now,
                lastActivity: now,
              },
              select: { id: true },
            }),
            db.interpreterStatusLog.create({
              data: {
                interpreterId: interp.id,
                previousStatus: 'Busy',
                newStatus: 'Online',
                reason: 'auto_remediated',
                changedBy: 'system',
                metadata: { source: 'anomaly_detector', autoFix: true },
              },
            }),
            ...(await (async () => {
              const existing = await db.notification.findFirst({
                where: { title: { contains: interp.name }, type: 'warning', isRead: false },
              });
              if (!existing) {
                return [
                  db.notification.create({
                    data: {
                      title: `🟡 ${interp.name} estado corregido`,
                      message: `${interp.name} estaba "Busy" sin llamada activa. Se corrigió automáticamente a "Online".`,
                      type: 'warning',
                      isRead: false,
                      link: '/admin/monitoring',
                    },
                  }),
                ];
              }
              return [];
            })()),
          ]);
          busyNoCall++;
        }
      }

      // 3. Away for > 2 hours
      const awayInterpreters = await db.interpreter.findMany({
        where: {
          realtimeStatus: 'Away',
          statusChangedAt: { lt: twoHoursAgo },
          status: 'Activo',
        },
        select: { id: true, name: true, externalId: true, statusChangedAt: true },
      });

      for (const interp of awayInterpreters) {
        const existingAlert = await db.notification.findFirst({
          where: { title: { contains: interp.name }, type: 'warning', isRead: false },
        });
        if (!existingAlert) {
          await createAlert({
            title: `🟠 ${interp.name} ausente por +2h`,
            message: `${interp.name} (${interp.externalId}) está "Ausente" desde hace más de 2 horas.`,
            type: 'warning',
            category: 'status',
            link: '/admin/monitoring',
          });
        }
        awayLong++;
      }
    }

    // 4. Multiple concurrent offline (regardless of working hours)
    const totalActive = await db.interpreter.count({ where: { status: 'Activo' } });
    const totalOnline = await db.interpreter.count({
      where: { realtimeStatus: { not: 'Offline' }, status: 'Activo' },
    });
    const totalOffline = totalActive - totalOnline;

    if (totalOffline > Math.floor(totalActive * 0.5) && totalOffline >= 5) {
      const existingAlert = await db.notification.findFirst({
        where: { title: '🚨 Múltiples intérpretes offline', isRead: false },
      });
      if (!existingAlert) {
        await createAlert({
          title: '🚨 Múltiples intérpretes offline',
          message: `${totalOffline} de ${totalActive} intérpretes están offline (${Math.round((totalOffline / totalActive) * 100)}%). Posible problema de conectividad.`,
          type: 'critical',
          category: 'fleet',
          link: '/admin/monitoring',
        });
      }
    }

    return { offlineLong, busyNoCall, awayLong };
  } catch (error) {
    console.error('[Anomaly] Detection failed:', error);
    return { offlineLong: 0, busyNoCall: 0, awayLong: 0 };
  }
}