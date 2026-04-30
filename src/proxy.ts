import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from 'jose';

const isPublicRoute = (path: string) => {
  return path.startsWith('/login') || 
         path.startsWith('/register') || 
         path.startsWith('/api/') || 
         path === '/';
};

export const proxy = async (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  
  if (isPublicRoute(path)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secretKey = process.env.JWT_SECRET || 'super-secret-fallback-key-for-free-interpreters';
    const key = new TextEncoder().encode(secretKey);
    await jwtVerify(sessionCookie, key, { algorithms: ['HS256'] });
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
};

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
