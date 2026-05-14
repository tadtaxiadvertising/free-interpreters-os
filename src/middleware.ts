import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * MIDDLEWARE — INTERPRETERS-API
 * ============================================================
 * RESPONSABILIDADES:
 *   1. CORS Preflight (OPTIONS) → respuesta inmediata 204
 *   2. Auth Guard → redirige rutas protegidas si no hay sesión
 *
 * ARQUITECTURA:
 *   El middleware corre en Edge Runtime. No puede importar Prisma,
 *   pg, ni ningún módulo de Node.js puro. Solo verifica cookies.
 * 
 * CORS:
 *   Los headers se aplican TANTO aquí (preflight) como en
 *   next.config.ts (responses). Esto garantiza cobertura completa
 *   incluso si el middleware no intercepta ciertos paths.
 * ============================================================
 */

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://freeinterpreters.com";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. CORS PREFLIGHT ──────────────────────────────────────
  // Browsers envían OPTIONS antes de POST/PUT/DELETE cross-origin.
  // Debemos responder con 204 (No Content) + headers CORS.
  // Sin esto, el frontend recibe un error de red antes de enviar el request real.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // ── 2. AUTH GUARD ──────────────────────────────────────────
  // Soporte Dual: Auth.js (NextAuth) y Supabase Auth (Cookie Stateless)
  // Esto previene redirecciones incorrectas si el usuario aún usa Supabase en algunas partes.
  const nextAuthToken = req.cookies.get('next-auth.session-token')?.value || 
                       req.cookies.get('__Secure-next-auth.session-token')?.value;
                       
  const supabaseToken = req.cookies.getAll().find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.value;

  const sessionToken = nextAuthToken || supabaseToken;

  // Definimos estrictamente las rutas protegidas
  const isProtectedRoute = /^\/(admin|payroll|qa|production|recruitment|interpreters|settings)/.test(pathname);

  // Redirección rápida si intenta entrar a una zona protegida sin sesión
  if (isProtectedRoute && !sessionToken) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── 3. PROPAGATE CORS ON ALL API RESPONSES ─────────────────
  // Next.js config headers cubren la mayoría, pero el middleware
  // asegura que también se apliquen a respuestas dinámicas.
  const response = NextResponse.next();
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
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
