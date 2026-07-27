-- Migration: add category column to notifications
-- Stack: Prisma 7 + Supabase PostgreSQL
-- Date: 2026-07-27
-- Reason: Prisma schema already declares `category String? @default("system")` but the column was never migrated to the DB.

BEGIN;

-- 1. Add the column with a safe default for existing rows
ALTER TABLE "public"."notifications"
  ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) NOT NULL DEFAULT 'system';

-- 2. Create the index Prisma expects (matches schema index definition)
CREATE INDEX IF NOT EXISTS "idx_notifications_category"
  ON "public"."notifications" ("category");

-- 3. Backfill: stamp any NULLs (none after ADD COLUMN … DEFAULT, but keep for safety)
UPDATE "public"."notifications"
  SET "category" = 'system'
 WHERE "category" IS NULL;

COMMIT;
