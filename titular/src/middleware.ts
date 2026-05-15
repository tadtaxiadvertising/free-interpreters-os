import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: any) {
    const role = req.nextauth.token?.role;
    // El servicio 'titular' solo permite el rol 'OWNER'
    if (req.nextUrl.pathname.startsWith("/") && role !== "OWNER") {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  },
  {
    callbacks: {
      authorized: ({ token }: { token: any }) => !!token,
    },
  }
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|unauthorized).*)'],
};
