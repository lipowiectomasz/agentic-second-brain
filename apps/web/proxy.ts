import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const publicPrefixes = ["/login", "/signup", "/auth/", "/status"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set("x-cortex-path", `${pathname}${search}`);
  const isPublic = publicPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  if (!isPublic && !request.cookies.has("cortex_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
