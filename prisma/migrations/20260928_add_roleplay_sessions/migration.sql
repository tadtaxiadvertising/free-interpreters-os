-- Roleplay metadata only. Audio files are stored in the private
-- `roleplay-audio` Supabase Storage bucket, never in PostgreSQL.
CREATE TYPE "public"."RoleplayStatus" AS ENUM ('PENDING', 'EVALUATED');

CREATE TABLE "public"."roleplay_sessions" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "interpreter_id" INTEGER,
    "recruitment_candidate_id" INTEGER,
    "base_audio_url" TEXT NOT NULL,
    "recorded_audio_url" TEXT,
    "status" "public"."RoleplayStatus" NOT NULL DEFAULT 'PENDING',
    "evaluator_id" UUID,
    "qa_score_id" INTEGER,
    "submitted_at" TIMESTAMPTZ(6),
    "evaluated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roleplay_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roleplay_sessions_subject_check" CHECK (
      ("interpreter_id" IS NOT NULL AND "recruitment_candidate_id" IS NULL)
      OR ("interpreter_id" IS NULL AND "recruitment_candidate_id" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "roleplay_sessions_qa_score_id_key" ON "public"."roleplay_sessions"("qa_score_id");
CREATE INDEX "idx_roleplay_sessions_interpreter_status" ON "public"."roleplay_sessions"("interpreter_id", "status");
CREATE INDEX "idx_roleplay_sessions_candidate_status" ON "public"."roleplay_sessions"("recruitment_candidate_id", "status");
CREATE INDEX "idx_roleplay_sessions_status_created" ON "public"."roleplay_sessions"("status", "created_at" DESC);

ALTER TABLE "public"."roleplay_sessions"
  ADD CONSTRAINT "roleplay_sessions_interpreter_id_fkey"
  FOREIGN KEY ("interpreter_id") REFERENCES "public"."interpreters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "roleplay_sessions_recruitment_candidate_id_fkey"
  FOREIGN KEY ("recruitment_candidate_id") REFERENCES "public"."recruitment_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "roleplay_sessions_qa_score_id_fkey"
  FOREIGN KEY ("qa_score_id") REFERENCES "public"."qa_scores"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "roleplay_sessions_evaluator_id_fkey"
  FOREIGN KEY ("evaluator_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
