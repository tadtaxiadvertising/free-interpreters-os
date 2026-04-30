-- ═══════════════════════════════════════════════════════════════════════════════
-- MASTER_SETUP.SQL — Free Interpreters OS
-- Run this ONE file in the Supabase SQL Editor to fully provision the database.
-- Order: 1) Schema → 2) RLS Policies → 3) Functions & Triggers
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 — SCHEMA (Tables & Indexes)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Interpreters
CREATE TABLE IF NOT EXISTS public.interpreters (
    id SERIAL PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'Activo',
    realtime_status TEXT DEFAULT 'Offline',
    campaign TEXT,
    language_a TEXT DEFAULT 'Español',
    language_b TEXT DEFAULT 'Inglés',
    email_corporativo TEXT UNIQUE,
    telefono TEXT,
    pais TEXT,
    metodo_pago TEXT,
    cuenta_pago TEXT,
    documentos_completo BOOLEAN DEFAULT FALSE,
    notas TEXT,
    tariff_per_minute DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interpreters_status ON public.interpreters(status);
CREATE INDEX IF NOT EXISTS idx_interpreters_pais ON public.interpreters(pais);
CREATE INDEX IF NOT EXISTS idx_interpreters_created_at ON public.interpreters(created_at);

-- 3. Interpreter Account Rates
CREATE TABLE IF NOT EXISTS public.interpreter_account_rates (
    id SERIAL PRIMARY KEY,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES public.accounts(id) ON DELETE CASCADE,
    tariff_per_hour DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(interpreter_id, account_id)
);

-- 4. Production Logs
CREATE TABLE IF NOT EXISTS public.production_logs (
    id SERIAL PRIMARY KEY,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES public.accounts(id),
    date DATE NOT NULL,
    campaign TEXT,
    scheduled_hours TEXT,
    login_time TIMESTAMPTZ,
    logout_time TIMESTAMPTZ,
    connected_hours DECIMAL(10, 2),
    interpreted_minutes INTEGER DEFAULT 0,
    calls_attended INTEGER DEFAULT 0,
    adherence DECIMAL(5, 2),
    status TEXT NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_logs_date ON public.production_logs(date);
CREATE INDEX IF NOT EXISTS idx_production_logs_interpreter_date ON public.production_logs(interpreter_id, date);
CREATE INDEX IF NOT EXISTS idx_production_logs_status ON public.production_logs(status);

-- 5. QA Scores
CREATE TABLE IF NOT EXISTS public.qa_scores (
    id SERIAL PRIMARY KEY,
    production_log_id INTEGER UNIQUE REFERENCES public.production_logs(id) ON DELETE CASCADE,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    audit_date TIMESTAMPTZ NOT NULL,
    auditor TEXT,
    call_duration INTEGER,
    call_type TEXT,
    protocol_score DECIMAL(5, 2),
    interpretation_score DECIMAL(5, 2),
    language_score DECIMAL(5, 2),
    service_score DECIMAL(5, 2),
    technical_score DECIMAL(5, 2),
    total_score DECIMAL(5, 2),
    critical_error BOOLEAN DEFAULT FALSE,
    comentarios TEXT,
    accion_requerida TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_scores_audit_date ON public.qa_scores(audit_date);
CREATE INDEX IF NOT EXISTS idx_qa_scores_interpreter_id ON public.qa_scores(interpreter_id);

-- 6. Payroll Records
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    total_minutes INTEGER NOT NULL,
    gross_total DECIMAL(10, 2) NOT NULL,
    quality_bonus DECIMAL(10, 2) DEFAULT 0,
    penalidades DECIMAL(10, 2) DEFAULT 0,
    transfer_deduction DECIMAL(10, 2) DEFAULT 0,
    net_total DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'Pendiente',
    payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON public.payroll_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_records_interpreter ON public.payroll_records(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON public.payroll_records(status);

-- 7. Recruitment Candidates
CREATE TABLE IF NOT EXISTS public.recruitment_candidates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    pais TEXT,
    fuente TEXT,
    english_level TEXT,
    speedtest_mbps INTEGER,
    status TEXT DEFAULT 'Aplicante',
    fecha_postulacion TIMESTAMPTZ NOT NULL,
    fecha_entrevista TIMESTAMPTZ,
    result_roleplay INTEGER,
    fecha_oferta TIMESTAMPTZ,
    fecha_inicio TIMESTAMPTZ,
    responsable TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_status ON public.recruitment_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_fecha_postulacion ON public.recruitment_candidates(fecha_postulacion);

-- 8. System Config
CREATE TABLE IF NOT EXISTS public.system_configs (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- 9. Payrate Audit Log
CREATE TABLE IF NOT EXISTS public.payrate_audit_log (
    id SERIAL PRIMARY KEY,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    old_rate DECIMAL(10, 2),
    new_rate DECIMAL(10, 2) NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. User Profiles (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'interpreter',
    interpreter_id INTEGER UNIQUE REFERENCES public.interpreters(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- 12. Call Sessions
CREATE TABLE IF NOT EXISTS public.call_sessions (
    id SERIAL PRIMARY KEY,
    interpreter_id INTEGER REFERENCES public.interpreters(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    tariff_snapshot DECIMAL(10, 2) NOT NULL,
    call_cost DECIMAL(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_interpreter_id ON public.call_sessions(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON public.call_sessions(started_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 — ROW LEVEL SECURITY (RLS Policies)
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

-- 8. ADMIN-ONLY TABLES
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

CREATE POLICY "Admins only access payrate audit log"
ON public.payrate_audit_log FOR ALL
USING (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3 — FUNCTIONS & TRIGGERS (Business Logic)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop triggers before recreating functions (idempotent)
DROP TRIGGER IF EXISTS trg_calculate_qa_total ON public.qa_scores;
DROP TRIGGER IF EXISTS trg_calculate_call_metrics ON public.call_sessions;
DROP TRIGGER IF EXISTS trg_interpreters_updated_at ON public.interpreters;
DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
DROP TRIGGER IF EXISTS trg_recruitment_candidates_updated_at ON public.recruitment_candidates;
DROP TRIGGER IF EXISTS trg_system_configs_updated_at ON public.system_configs;

-- 1. Function: Calculate QA Total Score (weighted)
CREATE OR REPLACE FUNCTION public.calculate_qa_total()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_score := (
        COALESCE(NEW.protocol_score, 0) * 0.20 +
        COALESCE(NEW.interpretation_score, 0) * 0.40 +
        COALESCE(NEW.language_score, 0) * 0.20 +
        COALESCE(NEW.service_score, 0) * 0.10 +
        COALESCE(NEW.technical_score, 0) * 0.10
    );
    -- Force total_score to 0 if critical_error is true
    IF NEW.critical_error THEN
        NEW.total_score := 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_qa_total
BEFORE INSERT OR UPDATE ON public.qa_scores
FOR EACH ROW EXECUTE FUNCTION public.calculate_qa_total();

-- 2. Function: Aggregate Payroll for a Period
CREATE OR REPLACE FUNCTION public.aggregate_interpreter_payroll(
    p_interpreter_id INTEGER,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_minutes BIGINT,
    gross_total DECIMAL(10, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(interpreted_minutes), 0)::BIGINT as total_minutes,
        COALESCE(SUM(interpreted_minutes * (
            SELECT tariff_per_minute FROM public.interpreters WHERE id = p_interpreter_id
        )), 0)::DECIMAL(10, 2) as gross_total
    FROM public.production_logs
    WHERE interpreter_id = p_interpreter_id
      AND date >= p_start_date
      AND date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- 3. Function: Calculate Call Duration & Cost on Session End
CREATE OR REPLACE FUNCTION public.calculate_call_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
        -- Ceil to charge for partial minutes (industry standard)
        NEW.call_cost := (CEIL(NEW.duration_seconds::DECIMAL / 60.0)) * NEW.tariff_snapshot;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_call_metrics
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.calculate_call_metrics();

-- 4. Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_interpreters_updated_at
BEFORE UPDATE ON public.interpreters
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_recruitment_candidates_updated_at
BEFORE UPDATE ON public.recruitment_candidates
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_system_configs_updated_at
BEFORE UPDATE ON public.system_configs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP COMPLETE ✅
-- Tables: 12 | RLS Policies: 16 | Functions: 4 | Triggers: 6
-- ─────────────────────────────────────────────────────────────────────────────
