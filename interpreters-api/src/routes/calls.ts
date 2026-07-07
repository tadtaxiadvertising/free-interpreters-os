import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/AppError.js';

const router = Router();

/**
 * MANUAL CALL ENTRY — Validation Schema
 * ────────────────────────────────────
 * Ensures minutes are positive integers and interpreterId is provided.
 */
const manualCallSchema = z.object({
  interpreterId: z.string().min(1, "Interpreter ID is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  minutes: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
}).refine(data => (data.startTime && data.endTime) || data.minutes, {
  message: "Must provide either (startTime and endTime) or minutes",
});


/**
 * POST /api/v1/calls/manual
 * Records a manual call entry for an interpreter.
 * Uses asyncHandler — no try/catch needed.
 */
router.post('/manual', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Auth check via shared secret (Easypanel ENV)
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_SECRET_KEY;

  if (!apiKey) {
    throw AppError.internal('API_SECRET_KEY not configured');
  }

  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    throw AppError.unauthorized('Invalid or missing API key');
  }

  // Strict validation with Zod — throws ZodError → globalErrorHandler → 400
  const { interpreterId, minutes, startTime, endTime, notes } = manualCallSchema.parse(req.body);

  let finalStartTime: Date;
  let finalEndTime: Date;
  let durationSeconds: number;

  if (startTime && endTime) {
    finalStartTime = new Date(startTime);
    finalEndTime = new Date(endTime);
    durationSeconds = Math.floor((finalEndTime.getTime() - finalStartTime.getTime()) / 1000);
  } else {
    // Fallback to minutes
    finalEndTime = new Date();
    durationSeconds = (minutes || 0) * 60;
    finalStartTime = new Date(finalEndTime.getTime() - (durationSeconds * 1000));
  }

  if (durationSeconds <= 0) {
    throw AppError.badRequest('Duration must be positive');
  }

  // 3. Verify interpreter existence (using externalId)
  const interpreter = await prisma.interpreter.findUnique({
    where: { externalId: interpreterId },
    select: { id: true },
  });

  if (!interpreter) {
    throw AppError.notFound(`Interpreter with externalId ${interpreterId} not found`);
  }

  // Get interpreter tariff for ProductionLog sync
  const interpreterWithTariff = await prisma.interpreter.findUnique({
    where: { id: interpreter.id },
    select: { tariffPerMinute: true },
  });

  const tariffSnapshot = Number(interpreterWithTariff?.tariffPerMinute || 0);
  const callCost = (durationSeconds / 60) * tariffSnapshot;

  const callSession = await prisma.callSession.create({
    data: {
      interpreterId: interpreter.id,
      startedAt: finalStartTime,
      endedAt: finalEndTime,
      durationSeconds,
      tariffSnapshot,
      callCost,
      notes: notes || 'Manual entry recorded from UI',
    },
    select: {
      id: true,
      interpreterId: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      tariffSnapshot: true,
      notes: true,
      createdAt: true,
    },
  });

  // Sync to ProductionLog so metrics update immediately
  const minutes = Math.floor(durationSeconds / 60);
  if (minutes > 0) {
    // Use Santo Domingo timezone for date calculation
    const getLocalDateStr = (d: Date) => {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    };

    const dayStr = getLocalDateStr(finalStartTime);
    const logDate = new Date(`${dayStr}T12:00:00Z`);

    const existingLog = await prisma.productionLog.findFirst({
      where: {
        interpreterId: interpreter.id,
        date: logDate,
      },
    });

    if (existingLog) {
      await prisma.productionLog.update({
        where: { id: existingLog.id },
        data: {
          interpretedMinutes: (existingLog.interpretedMinutes || 0) + minutes,
          callsAttended: (existingLog.callsAttended || 0) + 1,
        },
      });
    } else {
      await prisma.productionLog.create({
        data: {
          interpreterId: interpreter.id,
          date: logDate,
          interpretedMinutes: minutes,
          callsAttended: 1,
          status: 'Completed',
          observaciones: 'Synced from external API',
          adherence: 100,
        },
      });
    }
  }

  res.status(201).json({
    success: true,
    message: 'Manual call log recorded successfully',
    data: callSession,
  });
}));

export default router;
