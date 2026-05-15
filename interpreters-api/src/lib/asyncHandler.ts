import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * asyncHandler — Automatic try/catch wrapper for Express controllers
 * ============================================================
 * Wraps an async route handler so that rejected promises are forwarded
 * to Express's error middleware instead of crashing the process.
 *
 * USAGE:
 *   router.get('/users', asyncHandler(async (req, res) => { ... }));
 *
 * This eliminates the need for try/catch in every controller.
 * ============================================================
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
