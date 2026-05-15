/**
 * AppError — Centralized HTTP Error Class
 * ============================================================
 * Extends native Error with a typed statusCode + operational flag.
 *
 * RULES:
 *   - NEVER expose stack traces to the client (handled by errorHandler).
 *   - Always pass a user-safe message. Internal details go to console.
 *   - Use `isOperational` to distinguish expected errors (bad input)
 *     from unexpected crashes (database down).
 *
 * USAGE:
 *   throw new AppError('User not found', 404);
 *   throw new AppError('Email already registered', 409);
 *   throw AppError.badRequest('Invalid email format');
 *   throw AppError.unauthorized('Token expired');
 * ============================================================
 */
export class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Preserve proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
    // ── Factory Methods ──────────────────────────────────────
    static badRequest(message = 'Bad Request') {
        return new AppError(message, 400);
    }
    static unauthorized(message = 'Unauthorized') {
        return new AppError(message, 401);
    }
    static forbidden(message = 'Forbidden') {
        return new AppError(message, 403);
    }
    static notFound(message = 'Resource not found') {
        return new AppError(message, 404);
    }
    static conflict(message = 'Resource already exists') {
        return new AppError(message, 409);
    }
    static internal(message = 'Internal Server Error') {
        return new AppError(message, 500, false);
    }
}
