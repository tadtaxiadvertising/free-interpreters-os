import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * MIDDLEWARE — FREE INTERPRETERS OS
 * ============================================================
 * RESPONSABILIDADES:
 *   1. Supabase Session Refresh → mantiene tokens válidos
 *   2. CORS Preflight (OPTIONS) → respuesta inmediata 204
 *   3. CORS Headers → en todas las respuestas /api/*
 *
 * ARQUITECTURA:
 *   El middleware corre en Edge Runtime. No puede importar Prisma,
 *   pg, ni ningún módulo de Node.js puro.
 *
 *   La función updateSession() de Supabase SSR es la pieza CRÍTICA
 *   que refresca los tokens de autenticación en cada request.
 *   Sin ella, las cookies expiran y auth() falla en server components.
 *
 * CORS:
 *   Los headers se aplican TANTO aquí (preflight) como en
 *   next.config.ts (responses). Esto garantiza cobertura completa
 *   incluso si el middleware no intercepta ciertos paths.
 * ============================================================
 */

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://freeinterpreters.com";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  // ── CORS ORIGIN VALIDATION ────────────────────────────────
  const isTrustedOrigin = !origin ||
    origin === FRONTEND_ORIGIN ||
    origin.endsWith('.easypanel.host') ||
    origin.includes('localhost');

  const corsOrigin = isTrustedOrigin && origin ? origin : FRONTEND_ORIGIN;

  // ── 1. CORS PREFLIGHT ─────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ── 2. SUPABASE SESSION REFRESH (CRITICAL) ────────────────
  // This refreshes the auth tokens on every request.
  // Without this, server components calling supabase.auth.getUser()
  // will get stale/expired tokens and redirect to /login.
  const response = await updateSession(req);

  // ── 3. PROPAGATE CORS ON ALL API RESPONSES ────────────────
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  }

  return response;
}

// MATCHER MAESTRO: Ignora _next, archivos estáticos e imágenes.
// INCLUYE /api para que el preflight CORS sea procesado.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
