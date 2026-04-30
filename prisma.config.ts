import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL for migrations (bypasses pgBouncer)
    // DATABASE_URL for the pooled runtime connection
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"]!,
  },
});
