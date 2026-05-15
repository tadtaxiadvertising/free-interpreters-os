import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    // Ignorar log de errores comunes en producción para ahorrar recursos de CPU y disco
    if (process.env.NODE_ENV === 'development' || !err.statusCode || err.statusCode >= 500) {
        console.error(`[ERROR] ${req.method} ${req.url}:`, {
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
    }
    // 1. Manejo de Errores de Validación (Zod)
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                type: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: err.issues.map((e) => ({
                    path: e.path.join('.'),
                    message: e.message,
                })),
            },
        });
    }
    // 2. Manejo de Errores de Prisma
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002: Violación de unicidad (Conflict)
        if (err.code === 'P2002') {
            return res.status(409).json({
                success: false,
                error: {
                    type: 'CONFLICT_ERROR',
                    message: 'A record with this value already exists.',
                    target: err.meta?.target || [],
                },
            });
        }
        // P2025: Registro no encontrado (Not Found)
        if (err.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: {
                    type: 'NOT_FOUND_ERROR',
                    message: 'Record not found.',
                },
            });
        }
        // Otros errores conocidos de Prisma (Bad Request)
        return res.status(400).json({
            success: false,
            error: {
                type: 'DATABASE_ERROR',
                message: 'Database request failed.',
                code: err.code,
            },
        });
    }
    // 3. Manejo de Errores de Sintaxis/JSON o Errores de Express
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: {
                type: 'PARSE_ERROR',
                message: 'Invalid JSON payload.',
            },
        });
    }
    // 4. Errores Generales / Custom AppError
    const message = statusCode === 500 ? 'Internal Server Error' : (err.message || 'Unknown error');
    return res.status(statusCode).json({
        success: false,
        error: {
            type: statusCode === 500 ? 'SERVER_ERROR' : 'APPLICATION_ERROR',
            message,
        },
    });
};
