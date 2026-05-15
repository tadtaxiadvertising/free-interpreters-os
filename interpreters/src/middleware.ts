import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Si no hay token, redirigir a login (opcional, dependiendo de tu flujo)
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/auth/signin";
    return NextResponse.redirect(url);
  }

  const role = token?.role;

  // El servicio 'interpreters' solo permite el rol 'INTERPRETER'
  if (req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/")) {
    if (role !== "INTERPRETER" && !req.nextUrl.pathname.startsWith("/unauthorized")) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|unauthorized).*)'],
};
