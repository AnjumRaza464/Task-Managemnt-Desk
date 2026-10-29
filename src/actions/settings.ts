"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { passwordChangeSchema, profileSchema } from "@/lib/validations/task";

export async function updateProfile(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = profileSchema.parse(input);
    const user = await prisma.user.update({
      where: { id: manager.id },
      data: { name: values.name, email: values.email },
    });
    await logActivity({
      actorId: manager.id,
      action: "PROFILE_UPDATED",
      entity: "User",
      entityId: user.id,
    });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { name: user.name, email: user.email };
  });
}

export async function changePassword(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = passwordChangeSchema.parse(input);
    const user = await prisma.user.findUnique({ where: { id: manager.id } });
    if (!user?.passwordHash) throw new ActionError("Password login is not enabled for this account.");

    const valid = await bcrypt.compare(values.currentPassword, user.passwordHash);
    if (!valid) throw new ActionError("Current password is incorrect.", { currentPassword: ["Incorrect password"] });

    await prisma.user.update({
      where: { id: manager.id },
      data: { passwordHash: await bcrypt.hash(values.newPassword, 12) },
    });
    await logActivity({
      actorId: manager.id,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: manager.id,
    });
    return undefined;
  });
}
