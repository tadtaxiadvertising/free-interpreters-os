import { auth } from "@/lib/auth-rbac-edge";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as { role?: string })?.role;
  const { pathname } = req.nextUrl;

  // Redirigir a login si no está logueado
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/portal-rbac/login", req.url));
  }

  // El servicio 'titular' solo permite el rol 'OWNER'
  if (role !== "OWNER" && pathname !== "/unauthorized") {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|unauthorized|portal-rbac/login).*)'],
};

