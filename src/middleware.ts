import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Obtenemos el token de Auth.js (soporte para dev local y producción con HTTPS)
  const sessionToken = req.cookies.get('next-auth.session-token')?.value || 
                       req.cookies.get('__Secure-next-auth.session-token')?.value;

  // Definimos estrictamente las rutas protegidas
  const isProtectedRoute = /^\/(admin|payroll|qa|production|recruitment|interpreters|settings)/.test(pathname);

  // Redirección rápida si intenta entrar a una zona protegida sin sesión
  if (isProtectedRoute && !sessionToken) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Si está logueado e intenta ir al root, puedes enviarlo al dashboard (Opcional, descomentar si aplica)
  // if (pathname === '/' && sessionToken) {
  //   return NextResponse.redirect(new URL('/admin', req.url));
  // }

  return NextResponse.next();
}

// MATCHER MAESTRO: Ignora _next, api, archivos estáticos e imágenes. ¡Crucial para el rendimiento!
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
