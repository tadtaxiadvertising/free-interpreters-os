import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/AppError.js';
const router = Router();
/**
 * MANUAL CALL ENTRY — ProductionLog Service
 * ───────────────────────────────────────
 * Optimized for data integrity and connection pooling.
 * Uses upsert to prevent duplicates on (interpreterId, date, accountId).
 */
const manualEntrySchema = z.object({
    interpreterId: z.number().int().positive("Interpreter ID must be a positive integer"),
    accountId: z.number().int().positive().optional(),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid ISO date string",
    }),
    interpreted_minutes: z.number().int().nonnegative("Minutes must be a non-negative integer"),
});
/**
 * POST /api/v1/production/manual-entry
 * Records or increments production minutes for an interpreter.
 * Uses asyncHandler — all errors flow to globalErrorHandler.
 */
router.post('/manual-entry', asyncHandler(async (req, res) => {
    // 1. Validation — throws ZodError → globalErrorHandler → 400
    const { interpreterId, accountId, date, interpreted_minutes } = manualEntrySchema.parse(req.body);
    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0); // Normalize to date only
    // 2. Process with atomic transaction to handle null accountId safely
    // Unique constraint (interpreterId, date, accountId) behavior with NULL depends on DB.
    // We use findFirst + update/create to be DB-agnostic and robust.
    const result = await prisma.$transaction(async (tx) => {
        // Check interpreter exists
        const interpreter = await tx.interpreter.findUnique({
            where: { id: interpreterId },
            select: { id: true },
        });
        if (!interpreter) {
            throw AppError.notFound('Interpreter not found');
        }
        // Find existing log for this day/interpreter/account
        const existingLog = await tx.productionLog.findFirst({
            where: {
                interpreterId,
                date: logDate,
                accountId: accountId || null,
            },
            select: { id: true, interpretedMinutes: true },
        });
        if (existingLog) {
            // Update existing
            return tx.productionLog.update({
                where: { id: existingLog.id },
                data: {
                    interpretedMinutes: { increment: interpreted_minutes },
                    status: 'Manual Entry (Updated)',
                },
                select: {
                    id: true,
                    interpreterId: true,
                    date: true,
                    interpretedMinutes: true,
                    status: true,
                    accountId: true,
                },
            });
        }
        else {
            // Create new
            return tx.productionLog.create({
                data: {
                    interpreterId,
                    date: logDate,
                    accountId: accountId || null,
                    interpretedMinutes: interpreted_minutes,
                    status: 'Manual Entry',
                },
                select: {
                    id: true,
                    interpreterId: true,
                    date: true,
                    interpretedMinutes: true,
                    status: true,
                    accountId: true,
                },
            });
        }
    });
    res.status(201).json({
        success: true,
        message: 'Production minutes recorded successfully',
        data: result,
    });
}));
export default router;
