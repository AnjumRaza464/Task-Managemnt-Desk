import type { Metadata } from "next";
import { CalendarCheck2 } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/dashboard";

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-black/20 blur-3xl" />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <CalendarCheck2 className="size-5" />
          </span>
          {APP_NAME}
        </div>
        <div className="relative max-w-md space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Plan every month. Track every task.
          </h1>
          <p className="text-primary-foreground/80">
            {APP_DESCRIPTION}. Assign work, follow progress and report results
            from one place.
          </p>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Managers plan and assign work; team members sign in to view their own tasks.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <CalendarCheck2 className="size-4" />
              </span>
              {APP_NAME}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your account to continue.
            </p>
          </div>
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </div>
  );
}
