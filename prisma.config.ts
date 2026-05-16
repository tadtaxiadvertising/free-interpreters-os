import "dotenv/config";
import { defineConfig } from "prisma/config";

if (!process.env["DIRECT_URL"] && !process.env["DATABASE_URL"]) {
  console.warn("[PRISMA CONFIG] WARNING: Neither DIRECT_URL nor DATABASE_URL are set in the environment.");
}

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

