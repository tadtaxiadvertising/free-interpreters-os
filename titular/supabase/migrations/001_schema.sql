-- ─────────────────────────────────────────────────────────────────────────────
-- 001_SCHEMA.SQL — Free Interpreters OS
-- Core table definitions based on Prisma schema
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

CREATE INDEX idx_interpreters_status ON public.interpreters(status);
CREATE INDEX idx_interpreters_pais ON public.interpreters(pais);
CREATE INDEX idx_interpreters_created_at ON public.interpreters(created_at);

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

CREATE INDEX idx_production_logs_date ON public.production_logs(date);
CREATE INDEX idx_production_logs_interpreter_date ON public.production_logs(interpreter_id, date);
CREATE INDEX idx_production_logs_status ON public.production_logs(status);

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

CREATE INDEX idx_qa_scores_audit_date ON public.qa_scores(audit_date);
CREATE INDEX idx_qa_scores_interpreter_id ON public.qa_scores(interpreter_id);

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

CREATE INDEX idx_payroll_records_period ON public.payroll_records(period_start, period_end);
CREATE INDEX idx_payroll_records_interpreter ON public.payroll_records(interpreter_id);
CREATE INDEX idx_payroll_records_status ON public.payroll_records(status);

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

CREATE INDEX idx_recruitment_candidates_status ON public.recruitment_candidates(status);
CREATE INDEX idx_recruitment_candidates_fecha_postulacion ON public.recruitment_candidates(fecha_postulacion);

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

-- 10. User Profiles (Linked to auth.users)
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

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

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

CREATE INDEX idx_call_sessions_interpreter_id ON public.call_sessions(interpreter_id);
CREATE INDEX idx_call_sessions_started_at ON public.call_sessions(started_at);
