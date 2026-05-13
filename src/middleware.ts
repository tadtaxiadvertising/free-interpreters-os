import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
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
    console.log(`[MIDDLEWARE] Redirigiendo a / por falta de token en: ${pathname}`);
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

// MATCHER MAESTRO: Ignora _next, api, archivos estáticos e imágenes.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
