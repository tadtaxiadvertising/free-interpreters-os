-- Add RoleplaySession and RoleplayAccess tables
-- This migration creates the tables for the Roleplay feature

-- Create RoleplayStatus enum
DO $$ BEGIN
  CREATE TYPE "public"."RoleplayStatus" AS ENUM ('PENDING', 'EVALUATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create RoleplaySession table
CREATE TABLE "public"."roleplay_sessions" (
    "id" TEXT NOT NULL,
    "interpreter_id" INTEGER,
    "recruitment_candidate_id" INTEGER,
    "base_audio_url" TEXT NOT NULL,
    "recorded_audio_url" TEXT,
    "status" "public"."RoleplayStatus" NOT NULL DEFAULT 'PENDING',
    "evaluator_id" TEXT,
    "qa_score_id" INTEGER UNIQUE,
    "submitted_at" TIMESTAMPTZ(6),
    "evaluated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "roleplay_sessions_pkey" PRIMARY KEY ("id")
);

-- Create RoleplayAccess table
CREATE TABLE "public"."roleplay_access" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    CONSTRAINT "roleplay_access_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "public"."roleplay_sessions" 
    ADD CONSTRAINT "roleplay_sessions_interpreter_id_fkey" 
    FOREIGN KEY ("interpreter_id") REFERENCES "public"."interpreters"("id") 
    ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."roleplay_sessions" 
    ADD CONSTRAINT "roleplay_sessions_recruitment_candidate_id_fkey" 
    FOREIGN KEY ("recruitment_candidate_id") REFERENCES "public"."recruitment_candidates"("id") 
    ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."roleplay_sessions" 
    ADD CONSTRAINT "roleplay_sessions_qa_score_id_fkey" 
    FOREIGN KEY ("qa_score_id") REFERENCES "public"."qa_scores"("id") 
    ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "public"."roleplay_access" 
    ADD CONSTRAINT "roleplay_access_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "public"."roleplay_sessions"("id") 
    ON DELETE CASCADE ON UPDATE NO ACTION;

-- Add unique constraint on session_id in roleplay_access
ALTER TABLE "public"."roleplay_access" 
    ADD CONSTRAINT "roleplay_access_session_id_key" UNIQUE ("session_id");

-- Add indexes
CREATE INDEX "idx_roleplay_interpreter_status" ON "public"."roleplay_sessions"("interpreter_id", "status");
CREATE INDEX "idx_roleplay_candidate_status" ON "public"."roleplay_sessions"("recruitment_candidate_id", "status");
CREATE INDEX "idx_roleplay_status_created" ON "public"."roleplay_sessions"("status", "created_at");
CREATE INDEX "idx_roleplay_status_submitted" ON "public"."roleplay_sessions"("status", "submitted_at");

CREATE INDEX "idx_roleplay_access_token_hash" ON "public"."roleplay_access"("token_hash");
CREATE INDEX "idx_roleplay_access_expires" ON "public"."roleplay_access"("expires_at");