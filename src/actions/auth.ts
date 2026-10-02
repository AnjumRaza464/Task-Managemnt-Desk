"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

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
      return { error: "Invalid email or password." };
    }
    // Next.js redirect() throws — rethrow so the navigation happens.
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
