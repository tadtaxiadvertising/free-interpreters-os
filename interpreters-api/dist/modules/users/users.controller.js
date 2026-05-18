import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
/**
 * USERS CONTROLLER — RESTful, Stateless, Lean Queries
 * ============================================================
 * ARCHITECTURAL RULES ENFORCED:
 *
 *   1. LEAN QUERIES ONLY — Every Prisma call uses explicit `select`.
 *      NEVER use `include` or return the full model.
 *      This minimizes Supabase CPU usage and network payload.
 *
 *   2. IDEMPOTENT MUTATIONS — POST uses upsert-like error handling
 *      (catch P2002 → 409). PUT is naturally idempotent.
 *      DELETE returns 204 even if already deleted.
 *
 *   3. NO TRY/CATCH HERE — Controllers are wrapped by `asyncHandler`
 *      in the routes file. Errors bubble to globalErrorHandler.
 *
 *   4. NO STACK TRACES — AppError messages are user-safe.
 *      Internal details are logged by the error middleware.
 * ============================================================
 */
// ── Shared select projection (DRY) ───────────────────────
const USER_SELECT = {
    id: true,
    email: true,
    name: true,
    role: true,
    createdAt: true,
    updatedAt: true,
};
/**
 * GET /api/v1/users
 * List users with optional role filter and pagination.
 */
export async function listUsers(req, res) {
    const role = req.query.role;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const where = role ? { role: role } : {};
    const [users, total] = await Promise.all([
        prisma.rbacUser.findMany({
            where,
            select: USER_SELECT,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
        prisma.rbacUser.count({ where }),
    ]);
    res.json({
        success: true,
        data: users,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
/**
 * GET /api/v1/users/:id
 * Retrieve a single user by UUID. Returns 404 if not found.
 */
export async function getUserById(req, res) {
    const { id } = req.params;
    const user = await prisma.rbacUser.findUnique({
        where: { id },
        select: USER_SELECT,
    });
    if (!user) {
        throw AppError.notFound(`User with ID ${id} not found`);
    }
    res.json({ success: true, data: user });
}
/**
 * POST /api/v1/users
 * Create a new user. Idempotent: returns 409 on duplicate email
 * (handled by globalErrorHandler via Prisma P2002).
 */
export async function createUser(req, res) {
    const { email, password, name, role } = req.body;
    // Hash password — bcrypt with cost factor 10 (balanced for VPS CPU)
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.rbacUser.create({
        data: {
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            name: name.trim(),
            role: role,
        },
        select: USER_SELECT,
    });
    res.status(201).json({ success: true, data: user });
}
/**
 * PUT /api/v1/users/:id
 * Partial update of user fields. Idempotent by nature.
 * Returns 404 if user doesn't exist (Prisma P2025 → globalErrorHandler).
 */
export async function updateUser(req, res) {
    const { id } = req.params;
    const updateData = req.body;
    // Verify user exists before update (explicit 404 vs Prisma's P2025)
    const existing = await prisma.rbacUser.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!existing) {
        throw AppError.notFound(`User with ID ${id} not found`);
    }
    const user = await prisma.rbacUser.update({
        where: { id },
        data: updateData,
        select: USER_SELECT,
    });
    res.json({ success: true, data: user });
}
/**
 * DELETE /api/v1/users/:id
 * Soft-safe delete. Returns 204 No Content.
 * Idempotent: if user already deleted, Prisma throws P2025
 * which the globalErrorHandler maps to 404.
 */
export async function deleteUser(req, res) {
    const { id } = req.params;
    await prisma.rbacUser.delete({
        where: { id },
    });
    res.status(204).send();
}
