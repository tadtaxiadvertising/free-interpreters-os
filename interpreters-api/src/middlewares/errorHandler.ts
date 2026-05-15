import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/AppError.js';

/**
 * UNIFIED ERROR HANDLER MIDDLEWARE
 * ============================================================
 * Single point of error processing for the entire Express app.
 *
 * ORDER OF PRECEDENCE:
 *   1. Zod validation errors → 400 with field-level details
 *   2. AppError instances → custom statusCode with safe message
 *   3. Prisma known errors → mapped to HTTP semantics (409, 404, 400)
 *   4. Prisma validation errors → 400
 *   5. Prisma initialization errors → 503 (DB unreachable)
 *   6. JSON parse errors → 400
 *   7. Unknown errors → 500 with generic message (no stack leak)
 *
 * RULES:
 *   - NEVER send stack trace to client (logged internally only).
 *   - All responses follow { success, error: { type, message, details? } }.
 *   - Internal logging goes to console for Easypanel log viewer.
 * ============================================================
 */
export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {

  // Guard: if headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return _next(err);
  }

  // ── 1. ZOD VALIDATION ERRORS ────────────────────────────
  if (err instanceof ZodError) {
    logInternal(req, 'VALIDATION_ERROR', err.message, 400);

    res.status(400).json({
      success: false,
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
    return;
  }

  // ── 2. APPLICATION ERRORS (AppError) ────────────────────
  if (err instanceof AppError) {
    logInternal(req, 'APP_ERROR', err.message, err.statusCode);

    res.status(err.statusCode).json({
      success: false,
      error: {
        type: err.statusCode >= 500 ? 'SERVER_ERROR' : 'APPLICATION_ERROR',
        message: err.message,
      },
    });
    return;
  }

  // ── 3. PRISMA KNOWN REQUEST ERRORS ──────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logInternal(req, `PRISMA_${err.code}`, err.message);

    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          type: 'CONFLICT_ERROR',
          message: 'A record with this value already exists.',
          target: (err.meta?.target as string[]) || [],
        },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          type: 'NOT_FOUND_ERROR',
          message: 'Record not found.',
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: {
        type: 'DATABASE_ERROR',
        message: 'Database request failed.',
        code: err.code,
      },
    });
    return;
  }

  // ── 4. PRISMA VALIDATION ERRORS ─────────────────────────
  if (err instanceof Prisma.PrismaClientValidationError) {
    logInternal(req, 'PRISMA_VALIDATION', err.message);

    res.status(400).json({
      success: false,
      error: {
        type: 'DATABASE_VALIDATION_ERROR',
        message: 'Invalid database query structure.',
      },
    });
    return;
  }

  // ── 5. PRISMA INITIALIZATION ERRORS ─────────────────────
  // Indicates the DB is unreachable or credentials are wrong.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    logInternal(req, 'PRISMA_INIT_ERROR', err.message, 503);

    res.status(503).json({
      success: false,
      error: {
        type: 'SERVICE_UNAVAILABLE',
        message: 'Database connection unavailable. Please try again later.',
      },
    });
    return;
  }

  // ── 6. JSON PARSE ERRORS ────────────────────────────────
  const errWithType = err as { type?: string };
  if (errWithType.type === 'entity.parse.failed') {
    res.status(400).json({
      success: false,
      error: {
        type: 'PARSE_ERROR',
        message: 'Invalid JSON payload.',
      },
    });
    return;
  }

  // ── 7. UNHANDLED / UNKNOWN ERRORS ───────────────────────
  const unknownErr = err instanceof Error ? err : new Error(String(err));
  logInternal(req, 'UNHANDLED_ERROR', unknownErr.message, 500, unknownErr.stack);

  res.status(500).json({
    success: false,
    error: {
      type: 'SERVER_ERROR',
      message: 'Internal Server Error',
    },
  });
};


// ── Internal Logging (Easypanel Console) ──────────────────
function logInternal(
  req: Request,
  type: string,
  message: string,
  statusCode?: number,
  stack?: string
): void {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;

  console.error(
    JSON.stringify({
      timestamp,
      type,
      method,
      url,
      statusCode,
      message: message.slice(0, 500), // Truncate long messages to save log space
      // Stack only in dev — never in production to save disk/CPU
      ...(process.env.NODE_ENV === 'development' && stack ? { stack } : {}),
    })
  );
}
