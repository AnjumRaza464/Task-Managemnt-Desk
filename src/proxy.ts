import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];
const MEMBER_PREFIX = "/my-tasks";

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;
  const isLoggedIn = !!user;
  const { pathname } = nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isApi = pathname.startsWith("/api/");

  if (!isLoggedIn) {
    if (isPublic) return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", nextUrl);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const isMember = user?.role === "MEMBER";
  const home = isMember ? MEMBER_PREFIX : "/dashboard";

  if (isPublic || pathname === "/") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  // Members may only use their own read-only area (and API routes, which check ownership themselves).
  if (isMember && !pathname.startsWith(MEMBER_PREFIX) && !isApi) {
    return NextResponse.redirect(new URL(MEMBER_PREFIX, nextUrl));
  }
  // Managers do not use the member area.
  if (!isMember && pathname.startsWith(MEMBER_PREFIX)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Auth.js routes, Next internals and static assets.
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map)$).*)",
  ],
};
