import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * One-off after managers stopped seeing every project: makes each manager a
 * member (role MANAGER) of the projects they created, created tasks in,
 * assigned people to, or are assigned to, so nothing they worked on
 * disappears from their sidebar. Safe to run again; existing rows are kept.
 *
 *   npx tsx prisma/backfill-manager-members.ts
 */
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const managers = await prisma.user.findMany({ where: { role: "MANAGER" }, select: { id: true, name: true } });
  let added = 0;
  for (const m of managers) {
    const [created, createdTasks, assignedTasks, memberOf] = await Promise.all([
      prisma.project.findMany({ where: { createdById: m.id }, select: { id: true } }),
      prisma.task.findMany({ where: { createdById: m.id, projectId: { not: null } }, select: { projectId: true }, distinct: ["projectId"] }),
      prisma.taskAssignee.findMany({
        where: { OR: [{ assignedById: m.id }, { userId: m.id }], task: { projectId: { not: null } } },
        select: { task: { select: { projectId: true } } },
      }),
      prisma.projectMember.findMany({ where: { userId: m.id }, select: { projectId: true } }),
    ]);
    const have = new Set(memberOf.map((r) => r.projectId));
    const wanted = new Set<string>([
      ...created.map((p) => p.id),
      ...createdTasks.map((t) => t.projectId!).filter(Boolean),
      ...assignedTasks.map((a) => a.task.projectId!).filter(Boolean),
    ]);
    const missing = [...wanted].filter((id) => !have.has(id));
    if (missing.length === 0) continue;
    await prisma.projectMember.createMany({
      data: missing.map((projectId) => ({ projectId, userId: m.id, role: "MANAGER", addedById: m.id })),
      skipDuplicates: true,
    });
    added += missing.length;
    console.log(`${m.name}: added to ${missing.length} project(s)`);
  }
  console.log(`Done. ${managers.length} manager(s) checked, ${added} membership(s) added.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
