"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/app-url";
import { logActivity } from "@/lib/activity";
import { renderEmail, sendEmail } from "@/lib/email";
import { APP_NAME } from "@/lib/constants";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/task";

export type ForgotPasswordState = { sent?: boolean; error?: string } | undefined;
export type ResetPasswordState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Emails a one-time reset link. Always reports success so the form cannot be
 * used to find out which emails have accounts.
 */
export async function requestPasswordReset(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter the email you sign in with." };

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user || !user.isActive) return { sent: true };

  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - TOKEN_TTL_MS) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return { sent: true };

  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const url = `${await getAppUrl()}/reset-password?token=${token}`;
  const { html, text } = renderEmail({
    heading: "Reset your password",
    greeting: `Hi ${user.name.split(" ")[0]},`,
    lines: [
      `We received a request to reset the password for your ${APP_NAME} account.`,
      "Click the button below to choose a new password. The link works for 1 hour and can be used once.",
    ],
    cta: { label: "Reset password", url },
    footer: "If you did not request this, you can ignore this email. Your password will not change.",
  });
  await sendEmail({ to: user.email, subject: `Reset your ${APP_NAME} password`, html, text });
  return { sent: true };
}

/** Sets a new password from a valid, unused, unexpired token, then sends the user to sign in. */
export async function resetPassword(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      (fieldErrors[issue.path.map(String).join(".") || "_"] ??= []).push(issue.message);
    }
    return { error: parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
    include: { user: { select: { id: true, isActive: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.isActive) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } });
    await logActivity({ actorId: row.userId, action: "PASSWORD_RESET", entity: "User", entityId: row.userId }, tx);
  });

  redirect("/login?reset=1");
}
