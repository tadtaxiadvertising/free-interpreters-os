import { z } from 'zod';
/**
 * USERS MODULE — Zod Schemas
 * ============================================================
 * Every payload entering the API MUST be validated by a Zod schema.
 * If validation fails → 400 Bad Request with exact field details.
 *
 * NOTE: These schemas validate the `body` property of the request,
 * matching the validate() middleware pattern.
 * ============================================================
 */
// ── CREATE USER ───────────────────────────────────────────
export const createUserSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email format'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .max(128, 'Password must be at most 128 characters'),
        name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
        role: z.enum(['ADMIN', 'INTERPRETER', 'HOLDER']).default('INTERPRETER'),
    }),
});
// ── UPDATE USER ───────────────────────────────────────────
export const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(100).optional(),
        role: z.enum(['ADMIN', 'INTERPRETER', 'HOLDER']).optional(),
    }),
    params: z.object({
        id: z.string().uuid('Invalid user ID format'),
    }),
});
// ── GET USER BY ID (params only) ──────────────────────────
export const getUserByIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid user ID format'),
    }),
});
// ── LIST USERS (query params) ─────────────────────────────
export const listUsersSchema = z.object({
    query: z.object({
        role: z.enum(['ADMIN', 'INTERPRETER', 'HOLDER']).optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }),
});
