import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** One-off: give every existing project an "In review" list between "In progress" and "Done". */
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true, lists: { orderBy: { position: "asc" } } } });
  let added = 0;
  for (const p of projects) {
    if (p.lists.some((l) => l.name.toLowerCase() === "in review")) continue;
    const done = p.lists.find((l) => l.name.toLowerCase() === "done");
    const position = done ? done.position : (p.lists.at(-1)?.position ?? 0) + 1;
    await prisma.$transaction(async (tx) => {
      // Shift "Done" (and anything after it) down one slot, then insert "In review".
      for (const l of p.lists.filter((l) => l.position >= position)) {
        await tx.list.update({ where: { id: l.id }, data: { position: l.position + 1 } });
      }
      await tx.list.create({ data: { projectId: p.id, name: "In review", position } });
    });
    added++;
    console.log(`added In review to ${p.name}`);
  }
  console.log(`done: ${added} project(s) updated`);
}

main().finally(() => prisma.$disconnect());
