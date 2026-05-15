-- ─────────────────────────────────────────────────────────────────────────────
-- 002_RLS_POLICIES.SQL — Free Interpreters OS
-- Security layer for multi-role access (Admin vs Interpreter)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interpreters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interpreter_account_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrate_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Helper Function: Is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Drop existing policies before recreating (idempotent)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can manage all interpreters" ON public.interpreters;
DROP POLICY IF EXISTS "Interpreters can view their own profile data" ON public.interpreters;
DROP POLICY IF EXISTS "Interpreters can update their own profile data" ON public.interpreters;
DROP POLICY IF EXISTS "Admins can manage production logs" ON public.production_logs;
DROP POLICY IF EXISTS "Interpreters can view their own logs" ON public.production_logs;
DROP POLICY IF EXISTS "Admins can manage QA scores" ON public.qa_scores;
DROP POLICY IF EXISTS "Interpreters can view their own scores" ON public.qa_scores;
DROP POLICY IF EXISTS "Admins can manage payroll" ON public.payroll_records;
DROP POLICY IF EXISTS "Interpreters can view their own payroll" ON public.payroll_records;
DROP POLICY IF EXISTS "Admins can manage call sessions" ON public.call_sessions;
DROP POLICY IF EXISTS "Interpreters can manage their own sessions" ON public.call_sessions;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins only access recruitment" ON public.recruitment_candidates;
DROP POLICY IF EXISTS "Admins only access system config" ON public.system_configs;
DROP POLICY IF EXISTS "Admins only access accounts" ON public.accounts;
DROP POLICY IF EXISTS "Admins only access account rates" ON public.interpreter_account_rates;
DROP POLICY IF EXISTS "Admins only access payrate audit log" ON public.payrate_audit_log;

-- 1. USER PROFILES
CREATE POLICY "Users can view their own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
ON public.user_profiles FOR ALL
USING (public.is_admin());

-- 2. INTERPRETERS
CREATE POLICY "Admins can manage all interpreters"
ON public.interpreters FOR ALL
USING (public.is_admin());

CREATE POLICY "Interpreters can view their own profile data"
ON public.interpreters FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.interpreters.id
  )
);

CREATE POLICY "Interpreters can update their own profile data"
ON public.interpreters FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.interpreters.id
  )
);

-- 3. PRODUCTION LOGS
CREATE POLICY "Admins can manage production logs"
ON public.production_logs FOR ALL
USING (public.is_admin());

CREATE POLICY "Interpreters can view their own logs"
ON public.production_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.production_logs.interpreter_id
  )
);

-- 4. QA SCORES
CREATE POLICY "Admins can manage QA scores"
ON public.qa_scores FOR ALL
USING (public.is_admin());

CREATE POLICY "Interpreters can view their own scores"
ON public.qa_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.qa_scores.interpreter_id
  )
);

-- 5. PAYROLL RECORDS
CREATE POLICY "Admins can manage payroll"
ON public.payroll_records FOR ALL
USING (public.is_admin());

CREATE POLICY "Interpreters can view their own payroll"
ON public.payroll_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.payroll_records.interpreter_id
  )
);

-- 6. CALL SESSIONS
CREATE POLICY "Admins can manage call sessions"
ON public.call_sessions FOR ALL
USING (public.is_admin());

CREATE POLICY "Interpreters can manage their own sessions"
ON public.call_sessions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND interpreter_id = public.call_sessions.interpreter_id
  )
);

-- 7. NOTIFICATIONS
CREATE POLICY "Users can manage their own notifications"
ON public.notifications FOR ALL
USING (auth.uid() = user_id);

-- 8. RECRUITMENT & SYSTEM CONFIG (Admin Only)
CREATE POLICY "Admins only access recruitment"
ON public.recruitment_candidates FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins only access system config"
ON public.system_configs FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins only access accounts"
ON public.accounts FOR ALL
USING (public.is_admin());

CREATE POLICY "Admins only access account rates"
ON public.interpreter_account_rates FOR ALL
USING (public.is_admin());
