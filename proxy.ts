import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Root-path redirect.
 *
 * - Signed-in users (have a NextAuth session cookie) → /dashboard
 * - Everyone else                                → /signin
 *
 * NextAuth v5 requires the `__Secure-` prefix on the session cookie name
 * whenever the cookie is `secure: true` (i.e. in production over HTTPS).
 * On http://localhost the plain name is used.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const isProduction = process.env.NODE_ENV === "production";
  const sessionCookieName = isProduction
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";

  const hasSession = request.cookies.get(sessionCookieName)?.value;

  if (hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 307);
  }

  return NextResponse.redirect(new URL("/signin", request.url), 307);
}

export const config = {
  matcher: "/",
};
