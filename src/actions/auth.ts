"use server";

import { AuthError } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
import { endWorkSession, loginIdFor } from "@/lib/attendance";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  // Only allow same-origin relative redirects.
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/dashboard";

  try {
    await signIn("credentials", { email, password, redirectTo });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as { code?: string }).code;
      if (code === "inactive") {
        return { error: "This account has been deactivated. Contact an administrator." };
      }
      return { error: "Invalid username or password." };
    }
    // Next.js redirect() throws — rethrow so the navigation happens.
    throw error;
  }
}

export async function logoutAction() {
  // Check-out: close the work session opened by this sign-in.
  const session = await auth();
  if (session?.user?.id) {
    await endWorkSession(session.user.id, loginIdFor(session.user)).catch((error) => {
      console.error("Failed to record check-out", error);
    });
  }
  await signOut({ redirectTo: "/login" });
}
