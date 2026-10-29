import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";
import { BrandLogo, BrandMark } from "@/components/shared/brand-logo";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";
  const passwordReset = params.reset === "1";

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="dark relative hidden overflow-hidden bg-background text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <BrandLogo plain className="h-12" />
          <span className="sr-only">{APP_NAME}</span>
        </div>
        <div className="relative max-w-md space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Plan every month. <span className="text-primary">Track every task.</span>
          </h1>
          <p className="text-muted-foreground">
            {APP_DESCRIPTION}. Assign work, follow progress and report results
            from one place.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground/70">
          Managers plan and assign work; team members sign in to view their own tasks.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold lg:hidden">
              <BrandMark />
              {APP_NAME}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your account to continue.
            </p>
          </div>
          {passwordReset && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>Your password has been updated. Sign in with your new password.</span>
            </div>
          )}
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  );
}
