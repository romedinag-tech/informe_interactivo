import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Protege todas las rutas de la app salvo login y assets. La autorización fina
// (por rol / por informe) se hace en cada Server Action y Server Component.
export default auth((req) => {
  const isLoggedIn = Boolean(req.auth?.user);
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
