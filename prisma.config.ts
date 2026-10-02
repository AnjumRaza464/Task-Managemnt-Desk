import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Direct (non-pooled) connection for migrations; the app uses DATABASE_URL (pooled).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
