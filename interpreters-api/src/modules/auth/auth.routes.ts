import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { AuthController } from './auth.controller.js';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

/**
 * AUTH ROUTES — /api/auth
 * ============================================================
 * Pipeline per request:
 *   1. validate() → Zod schema validation (400 on failure)
 *   2. controller → executes business logic
 *   3. globalErrorHandler → formats any error response
 *
 * /login and /register are PUBLIC (no authGuard).
 * /me requires a valid JWT.
 * ============================================================
 */
const router = Router();

router.post('/login', validate(loginSchema), AuthController.login);
router.post('/register', validate(registerSchema), AuthController.register);
router.get('/me', authGuard, AuthController.me);

export default router;
