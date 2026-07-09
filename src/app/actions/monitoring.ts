'use server';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateAction } from '@/lib/auth/actions';
import { MonitoringFilterSchema } from '@/lib/validators/monitoring';
import type { MonitoredInterpreter } from '@/lib/validators/monitoring';
import type { ActionResult } from '@/lib/types';

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

    const interpreters = await prisma.interpreter.findMany({
      where,
      select: {
        id: true,
        name: true,
        externalId: true,
        campaign: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });

    return { success: true, data: interpreters as MonitoredInterpreter[] };
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
