/**
 * Clears every piece of portal data — users, monthly plans, tasks, subtasks,
 * comments, attachments, activity, notifications, chat, attendance sessions and
 * shared files — so a manager can start from scratch and create users and
 * tasks through the portal.
 *
 * Kept on purpose:
 *   - the seed admin account (SEED_ADMIN_EMAIL) so someone can still sign in
 *   - task categories (reference data, not user/task data)
 *
 * Dry run (prints what would be deleted, changes nothing):
 *   npx tsx prisma/reset-data.ts
 * Execute:
 *   npx tsx prisma/reset-data.ts --yes
 * Write a JSON backup first, then execute:
 *   npx tsx prisma/reset-data.ts --yes --backup backups/before-reset.json
 *
 * Run `npm run db:seed` afterwards to make sure the admin account exists with
 * the password from .env.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const args = process.argv.slice(2);
const execute = args.includes("--yes");
const backupFlag = args.indexOf("--backup");
const backupPath = backupFlag >= 0 ? args[backupFlag + 1] : undefined;

if (backupFlag >= 0 && (!backupPath || backupPath.startsWith("--"))) {
  console.error("--backup needs a file path");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@taskapp.local";

async function tableCounts() {
  const [
    users,
    monthlyPlans,
    tasks,
    subTasks,
    comments,
    attachments,
    activityLogs,
    notifications,
    chatMessages,
    workSessions,
    sharedFiles,
    sharedFileRecipients,
    categories,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.monthlyPlan.count(),
    prisma.task.count(),
    prisma.subTask.count(),
    prisma.comment.count(),
    prisma.attachment.count(),
    prisma.activityLog.count(),
    prisma.notification.count(),
    prisma.chatMessage.count(),
    prisma.workSession.count(),
    prisma.sharedFile.count(),
    prisma.sharedFileRecipient.count(),
    prisma.category.count(),
  ]);
  return {
    users,
    monthlyPlans,
    tasks,
    subTasks,
    comments,
    attachments,
    activityLogs,
    notifications,
    chatMessages,
    workSessions,
    sharedFiles,
    sharedFileRecipients,
    categories,
  };
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function writeBackup(path: string) {
  const target = resolve(path);
  const [attachments, sharedFiles] = await Promise.all([
    prisma.attachment.findMany(),
    prisma.sharedFile.findMany(),
  ]);
  const snapshot = {
    exportedAt: new Date().toISOString(),
    note: "Binary columns (Attachment.data, SharedFile.data) are base64 encoded.",
    users: await prisma.user.findMany(),
    categories: await prisma.category.findMany(),
    monthlyPlans: await prisma.monthlyPlan.findMany(),
    tasks: await prisma.task.findMany(),
    subTasks: await prisma.subTask.findMany(),
    comments: await prisma.comment.findMany(),
    attachments: attachments.map((a) => ({ ...a, data: toBase64(a.data) })),
    activityLogs: await prisma.activityLog.findMany(),
    notifications: await prisma.notification.findMany(),
    chatMessages: await prisma.chatMessage.findMany(),
    workSessions: await prisma.workSession.findMany(),
    sharedFiles: sharedFiles.map((f) => ({ ...f, data: toBase64(f.data) })),
    sharedFileRecipients: await prisma.sharedFileRecipient.findMany(),
  };
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(snapshot, null, 2));
  return target;
}

async function main() {
  const before = await tableCounts();
  const users = await prisma.user.findMany({
    select: { email: true, name: true, role: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const admin = users.find((u) => u.email === adminEmail);

  console.log("Current row counts:");
  console.table(before);
  console.log("Users:");
  console.table(users);
  console.log(
    admin
      ? `Keeping admin account ${adminEmail} (${admin.role}).`
      : `No user with email ${adminEmail} exists; run \`npm run db:seed\` after the reset to create it.`,
  );

  if (!execute) {
    console.log("\nDry run only. Re-run with --yes to delete the data above.");
    return;
  }

  if (backupPath) {
    const written = await writeBackup(backupPath);
    console.log(`Backup written to ${written}`);
  }

  // Children first, then parents. Required relations without onDelete
  // (Task.assignee, Comment.author, Attachment.uploadedBy, ActivityLog.actor)
  // would block deleting users otherwise.
  await prisma.$transaction([
    prisma.sharedFileRecipient.deleteMany(),
    prisma.sharedFile.deleteMany(),
    prisma.workSession.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.subTask.deleteMany(),
    prisma.task.deleteMany(),
    prisma.monthlyPlan.deleteMany(),
    prisma.user.deleteMany({ where: { email: { not: adminEmail } } }),
    // Clear the admin's own presence/read markers so nothing from the old data lingers.
    prisma.user.updateMany({
      where: { email: adminEmail },
      data: { lastSeenAt: null, teamChatReadAt: null },
    }),
  ]);

  const after = await tableCounts();
  console.log("\nRow counts after reset:");
  console.table(after);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
