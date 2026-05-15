import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

/**
 * AUTH CONTROLLER — Stateless, Wrapped by asyncHandler
 * ============================================================
 * No try/catch needed — asyncHandler forwards all errors
 * to globalErrorHandler automatically.
 * ============================================================
 */
export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await AuthService.login(req.body);
    res.json({ success: true, data: result });
  });

  static register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const user = await AuthService.register(req.body);
    res.status(201).json({ success: true, data: user });
  });

  static me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: (req as AuthRequest).user });
  });
}
