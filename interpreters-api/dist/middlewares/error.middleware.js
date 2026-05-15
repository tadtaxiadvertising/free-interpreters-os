import { ENV } from '../config/env.js';
export const errorMiddleware = (err, req, res, next) => {
    console.error('[SERVER_ERROR]', err);
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';
    res.status(status).json({
        success: false,
        error: message,
        // Solo enviar el stack en desarrollo
        stack: ENV.NODE_ENV === 'development' ? err.stack : undefined
    });
};
