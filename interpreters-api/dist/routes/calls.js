import { Router } from 'express';
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
router.post('/manual', asyncHandler(async (req, res) => {
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
    let finalStartTime;
    let finalEndTime;
    let durationSeconds;
    if (startTime && endTime) {
        finalStartTime = new Date(startTime);
        finalEndTime = new Date(endTime);
        durationSeconds = Math.floor((finalEndTime.getTime() - finalStartTime.getTime()) / 1000);
    }
    else {
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
        select: { externalId: true },
    });
    if (!interpreter) {
        throw AppError.notFound(`Interpreter with externalId ${interpreterId} not found`);
    }
    const callLog = await prisma.callLog.create({
        data: {
            interpreterId,
            startTime: finalStartTime,
            endTime: finalEndTime,
            durationSeconds,
            isManualEntry: true,
            notes: notes || 'Manual entry recorded from UI',
        },
        // LEAN QUERY: only return what the client needs
        select: {
            id: true,
            interpreterId: true,
            startTime: true,
            endTime: true,
            durationSeconds: true,
            isManualEntry: true,
            notes: true,
            createdAt: true,
        },
    });
    res.status(201).json({
        success: true,
        message: 'Manual call log recorded successfully',
        data: callLog,
    });
}));
export default router;
