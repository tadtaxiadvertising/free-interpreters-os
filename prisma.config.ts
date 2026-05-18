import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL bypasses pgBouncer for migrations (direct connection).
    // Falls back to DATABASE_URL (pooled) if DIRECT_URL is not set.
    // Both are injected at runtime by Easypanel — not available during `docker build`.
    url: env("DIRECT_URL") || env("DATABASE_URL"),
  },
});
