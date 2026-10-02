import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_CATEGORIES = [
  { name: "Development", color: "#6366f1" },
  { name: "Design", color: "#ec4899" },
  { name: "Marketing", color: "#f59e0b" },
  { name: "Sales", color: "#10b981" },
  { name: "Operations", color: "#0ea5e9" },
  { name: "Support", color: "#8b5cf6" },
  { name: "Finance", color: "#14b8a6" },
  { name: "HR", color: "#f43f5e" },
];

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@taskapp.local";
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "System Admin";

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD must be set in .env");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: "ADMIN", isActive: true },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash,
      designation: "Administrator",
      department: "Management",
    },
  });

  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { color: category.color },
      create: category,
    });
  }

  console.log(`Seeded admin ${admin.email} and ${DEFAULT_CATEGORIES.length} categories.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
