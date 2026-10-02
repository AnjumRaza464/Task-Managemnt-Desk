"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth-guard";
import { ActionError, runAction } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { userSchema } from "@/lib/validations/user";

function revalidateUsers() {
  revalidatePath("/users");
  revalidatePath("/dashboard");
  revalidatePath("/monthly-plans");
  revalidatePath("/tasks");
}

export async function createUser(input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = userSchema.parse(input);

    if (values.role !== "MEMBER" && !values.password) {
      throw new ActionError("A password is required for admin and manager accounts.", {
        password: ["Password is required for login-enabled roles"],
      });
    }

    const user = await prisma.user.create({
      data: {
        name: values.name,
        email: values.email,
        role: values.role,
        designation: values.designation,
        department: values.department,
        phone: values.phone,
        isActive: values.isActive,
        passwordHash: values.password ? await bcrypt.hash(values.password, 12) : null,
      },
    });

    await logActivity({
      actorId: manager.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      details: { name: user.name, role: user.role },
    });

    revalidateUsers();
    return { id: user.id };
  });
}

export async function updateUser(id: string, input: unknown) {
  return runAction(async () => {
    const manager = await requireManager();
    const values = userSchema.parse(input);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new ActionError("User not found.");

    if (values.role !== "MEMBER" && !existing.passwordHash && !values.password) {
      throw new ActionError("Set a password to enable login for this role.", {
        password: ["Password is required for login-enabled roles"],
      });
    }

    // Prevent removing your own manager access.
    if (existing.id === manager.id && (values.role === "MEMBER" || !values.isActive)) {
      throw new ActionError("You cannot deactivate or demote your own account.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: values.name,
        email: values.email,
        role: values.role,
        designation: values.designation,
        department: values.department,
        phone: values.phone,
        isActive: values.isActive,
        ...(values.password ? { passwordHash: await bcrypt.hash(values.password, 12) } : {}),
      },
    });

    await logActivity({
      actorId: manager.id,
      action: "USER_UPDATED",
      entity: "User",
      entityId: user.id,
      details: { name: user.name, role: user.role },
    });

    revalidateUsers();
    revalidatePath(`/users/${id}`);
    return { id: user.id };
  });
}

export async function setUserActive(id: string, isActive: boolean) {
  return runAction(async () => {
    const manager = await requireManager();
    if (id === manager.id && !isActive) {
      throw new ActionError("You cannot deactivate your own account.");
    }
    const user = await prisma.user.update({ where: { id }, data: { isActive } });
    await logActivity({
      actorId: manager.id,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entity: "User",
      entityId: user.id,
      details: { name: user.name },
    });
    revalidateUsers();
    revalidatePath(`/users/${id}`);
    return { isActive: user.isActive };
  });
}

export async function deleteUser(id: string) {
  return runAction(async () => {
    const manager = await requireManager();
    if (id === manager.id) throw new ActionError("You cannot delete your own account.");

    const user = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { assignedTasks: true } } },
    });
    if (!user) throw new ActionError("User not found.");

    await prisma.$transaction(async (tx) => {
      // Tasks created by this user should survive: reassign creator to the acting manager.
      await tx.task.updateMany({ where: { createdById: id }, data: { createdById: manager.id } });
      await tx.comment.updateMany({ where: { authorId: id }, data: { authorId: manager.id } });
      await tx.attachment.updateMany({ where: { uploadedById: id }, data: { uploadedById: manager.id } });
      await tx.activityLog.updateMany({ where: { actorId: id }, data: { actorId: manager.id } });
      // Assigned tasks + plans cascade via MonthlyPlan -> Task.
      await tx.user.delete({ where: { id } });
      await logActivity(
        {
          actorId: manager.id,
          action: "USER_DELETED",
          entity: "User",
          entityId: id,
          details: { name: user.name, deletedTasks: user._count.assignedTasks },
        },
        tx,
      );
    });

    revalidateUsers();
    return { deletedTasks: user._count.assignedTasks };
  });
}
