import { NextRequest, NextResponse } from "next/server";

const MEMBER_PREFIX = "/membership";
const ADMIN_PREFIX = "/admin";
const LOGIN_PATH = "/auth/login";

export function middleware(request: NextRequest) {
  const useCloudflareAuth = process.env.NEXT_PUBLIC_USE_CLOUDFLARE_AUTH === "true";
  if (!useCloudflareAuth) {
    return NextResponse.next();
  }

  const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "leosiqra_session";
  const roleCookieName = `${sessionCookieName}_role`;
  const hasSession = request.cookies.has(sessionCookieName);
  const role = request.cookies.get(roleCookieName)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(MEMBER_PREFIX) && !hasSession) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!hasSession) {
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/membership/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/membership/:path*", "/admin/:path*"],
};
