import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL bypasses pgBouncer for CLI commands (migrations, introspection).
    // Falls back to DATABASE_URL (pooled) if DIRECT_URL is not set.
    // The `?? ""` fallback allows `prisma generate` to succeed at Docker build time —
    // generate only reads schema.prisma and does NOT connect to the database.
    // Real credentials are injected at runtime by Easypanel.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
  },
});
