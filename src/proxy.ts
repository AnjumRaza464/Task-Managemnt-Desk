import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/offline", "/manifest.webmanifest"];
const MEMBER_PREFIX = "/my-tasks";
const MEMBER_PREFIXES = ["/my-tasks", "/my-files", "/my-projects", "/my-notifications"];
/** Admin-panel pages a manager may still open from the workspace area. */
const MANAGER_EXTRA = ["/settings"];
const isMemberPath = (pathname: string) => MEMBER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** Manager URLs that have a member-area twin, so shared links still land somewhere useful. */
function memberEquivalent(pathname: string): string {
  const task = pathname.match(/^\/tasks\/([^/]+)$/);
  if (task && task[1] !== "kanban") return `/my-tasks/${task[1]}`;
  const project = pathname.match(/^\/projects\/([^/]+)$/);
  if (project) return `/my-projects/${project[1]}`;
  if (pathname === "/workspaces") return "/my-projects";
  if (pathname === "/files") return "/my-files";
  if (pathname === "/notifications") return "/my-notifications";
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

  // Admins get the full admin panel; managers and members use the workspace area.
  const role = user?.role;
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isMember = !isAdmin;
  const home = isAdmin ? "/dashboard" : isManager ? "/my-projects" : MEMBER_PREFIX;

  if (pathname === "/offline" || pathname === "/manifest.webmanifest") return NextResponse.next();
  if (isPublic || pathname === "/") {
    return NextResponse.redirect(new URL(home, nextUrl));
  }

  const managerAllowed = isManager && MANAGER_EXTRA.some((p) => pathname === p || pathname.startsWith(p + "/"));
  // Members and managers stay in the workspace area (API routes check access themselves).
  if (isMember && !isMemberPath(pathname) && !isApi && !managerAllowed) {
    return NextResponse.redirect(new URL(memberEquivalent(pathname), nextUrl));
  }
  // Admins do not use the workspace area.
  if (isAdmin && isMemberPath(pathname)) {
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
