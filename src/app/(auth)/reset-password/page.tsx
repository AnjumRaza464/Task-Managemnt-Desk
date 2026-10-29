import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <AuthCard title="Reset link missing" description="Open the link from your email, or request a new one.">
        <Button className="w-full" nativeButton={false} render={<Link href="/forgot-password" />}>
          Request a new link
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="Use at least 8 characters. You will sign in with it right after.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
