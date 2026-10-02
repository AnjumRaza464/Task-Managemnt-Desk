import { ZodError } from "zod";
import { UnauthorizedError } from "@/lib/auth-guard";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Wraps a server action body: converts auth/validation/db errors into a
 * serializable ActionResult instead of throwing to the client.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const key = issue.path.map(String).join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      const first = error.issues[0]?.message ?? "Invalid input";
      return fail(first, fieldErrors);
    }
    if (error instanceof UnauthorizedError) {
      return fail(error.message);
    }
    if (error instanceof ActionError) {
      return fail(error.message, error.fieldErrors);
    }
    // Prisma unique constraint etc.
    const code = (error as { code?: string }).code;
    if (code === "P2002") return fail("A record with this value already exists.");
    if (code === "P2025") return fail("The record no longer exists.");
    console.error(error);
    return fail("Something went wrong. Please try again.");
  }
}

/** Throw inside an action to return a controlled error message. */
export class ActionError extends Error {
  fieldErrors?: Record<string, string[]>;
  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ActionError";
    this.fieldErrors = fieldErrors;
  }
}
