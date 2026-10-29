import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
const MEMBER_PREFIX = "/my-tasks";
const MEMBER_PREFIXES = ["/my-tasks", "/my-files"];
const isMemberPath = (pathname: string) => MEMBER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** Manager URLs that have a member-area twin (used by links in emails). */
function memberEquivalent(pathname: string): string {
  const task = pathname.match(/^\/tasks\/([^/]+)$/);
  if (task && task[1] !== "kanban") return `/my-tasks/${task[1]}`;
  if (pathname === "/files") return "/my-files";
  return MEMBER_PREFIX;
}

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
  if (isMember && !isMemberPath(pathname) && !isApi) {
    return NextResponse.redirect(new URL(memberEquivalent(pathname), nextUrl));
  }
  // Managers do not use the member area.
  if (!isMember && isMemberPath(pathname)) {
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
