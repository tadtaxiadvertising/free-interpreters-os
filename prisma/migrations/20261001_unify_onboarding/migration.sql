-- Unify onboarding state: make user_profiles.onboarding_complete the canonical source
-- Backfill interpreters.documentos_completo from user_profiles.onboarding_complete

-- Update interpreters.documentos_completo based on user_profiles.onboarding_complete
UPDATE "public"."interpreters" i
SET "documentos_completo" = up."onboardingComplete"
FROM "public"."user_profiles" up
WHERE i.id = up."interpreterId";

-- Add a comment to document the canonical state
COMMENT ON COLUMN "public"."user_profiles"."onboardingComplete" IS 'Canonical onboarding state. interpreters.documentos_completo is legacy and synced from this field.';
COMMENT ON COLUMN "public"."interpreters"."documentos_completo" IS 'Legacy onboarding state. Kept for backward compatibility. Canonical source is user_profiles.onboardingComplete.';