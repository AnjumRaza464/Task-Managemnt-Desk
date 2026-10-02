import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type CurrentManager = CurrentUser & { role: "ADMIN" | "MANAGER" };

export class UnauthorizedError extends Error {
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Resolves the signed-in user from the session and re-validates against the
 * database (active flag + role) so changes take effect immediately.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getCurrentManager(): Promise<CurrentManager | null> {
  const user = await getCurrentUser();
  if (!user || user.role === "MEMBER") return null;
  return user as CurrentManager;
}

/** For manager pages/layouts: members go to their own view, guests to /login. */
export async function requireManagerPage(): Promise<CurrentManager> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "MEMBER") redirect("/my-tasks");
  return user as CurrentManager;
}

/** For member pages: managers go to the dashboard, guests to /login. */
export async function requireMemberPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "MEMBER") redirect("/dashboard");
  return user;
}

/** For server actions & route handlers: throws when not an active manager. */
export async function requireManager(): Promise<CurrentManager> {
  const manager = await getCurrentManager();
  if (!manager) throw new UnauthorizedError();
  return manager;
}
