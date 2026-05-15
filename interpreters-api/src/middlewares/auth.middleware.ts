import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env.js';

export interface AuthRequest extends Request {
  user?: any;
}

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Acceso denegado: Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET);
    (req as AuthRequest).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Acceso denegado: Token inválido o expirado' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    if (!authReq.user || !roles.includes(authReq.user.role)) {
      return res.status(403).json({ success: false, error: 'Permisos insuficientes: Se requiere rol de ' + roles.join('/') });
    }
    next();
  };
};
