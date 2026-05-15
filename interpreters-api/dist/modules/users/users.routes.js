import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authGuard, authorize } from '../../middlewares/auth.middleware.js';
import { createUserSchema, updateUserSchema, getUserByIdSchema, listUsersSchema, } from './users.schemas.js';
import { listUsers, getUserById, createUser, updateUser, deleteUser, } from './users.controller.js';
/**
 * USERS ROUTES — /api/v1/users
 * ============================================================
 * Pipeline per request:
 *   1. authGuard → validates JWT token
 *   2. authorize() → checks role-based access
 *   3. validate() → Zod schema validation (400 on failure)
 *   4. asyncHandler(controller) → executes, catches errors
 *   5. globalErrorHandler → formats error response
 * ============================================================
 */
const router = Router();
// All user routes require authentication
router.use(authGuard);
// ── READ ──────────────────────────────────────────────────
router.get('/', authorize('ADMIN'), validate(listUsersSchema), asyncHandler(listUsers));
router.get('/:id', authorize('ADMIN'), validate(getUserByIdSchema), asyncHandler(getUserById));
// ── CREATE ────────────────────────────────────────────────
router.post('/', authorize('ADMIN'), validate(createUserSchema), asyncHandler(createUser));
// ── UPDATE ────────────────────────────────────────────────
router.put('/:id', authorize('ADMIN'), validate(updateUserSchema), asyncHandler(updateUser));
// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', authorize('ADMIN'), validate(getUserByIdSchema), asyncHandler(deleteUser));
export default router;
