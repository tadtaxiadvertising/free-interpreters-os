-- ============================================================
-- Free Interpreters CRM — Full DDL Schema (PostgreSQL / Neon.tech)
-- Phase 1: Complete database redesign with RBAC, indexes, 
--           transactional safety, and payroll-optimized views.
-- Target: Neon Serverless PostgreSQL (Free Tier)
-- ============================================================

BEGIN;

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- For gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";    -- Case-insensitive emails

-- ============================================================
-- 1. ENUM TYPES (Strict domain constraints)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE interpreter_status AS ENUM ('Activo','Training','Inactivo','Probation');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE realtime_status AS ENUM ('Online','Offline','Busy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('PayPal','BankTransfer','Payoneer','USDT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payroll_status AS ENUM ('Pendiente','Procesando','Aprobado','Pagado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin','qa_auditor','payroll_manager','interpreter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE candidate_status AS ENUM ('Aplicante','EntrevistaAgendada','Evaluacion','Rechazado','Contratado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qa_action AS ENUM ('Ninguna','Coaching','Advertencia','Suspension');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info','success','warning','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE log_entry_status AS ENUM ('Completed','NoShow','Late','Excused','Training');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- 2.1 USER PROFILES (Clerk-linked RBAC)
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id      VARCHAR(255) NOT NULL UNIQUE,  -- Clerk user ID (replaces Supabase auth)
  email         CITEXT NOT NULL UNIQUE,
  display_name  VARCHAR(255),
  role          user_role NOT NULL DEFAULT 'interpreter',
  interpreter_id INTEGER,                       -- FK added after interpreters table
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_clerk ON user_profiles(clerk_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 2.2 INTERPRETERS (Master Roster)
CREATE TABLE IF NOT EXISTS interpreters (
  id                  SERIAL PRIMARY KEY,
  external_id         VARCHAR(255) NOT NULL UNIQUE,
  name                VARCHAR(255) NOT NULL,
  status              interpreter_status NOT NULL DEFAULT 'Activo',
  realtime_status     realtime_status NOT NULL DEFAULT 'Offline',
  campaign            VARCHAR(255),
  language_a          VARCHAR(100) NOT NULL DEFAULT 'Español',
  language_b          VARCHAR(100) NOT NULL DEFAULT 'Inglés',
  email_corporativo   CITEXT UNIQUE,
  telefono            VARCHAR(30),
  pais                VARCHAR(100),
  metodo_pago         payment_method,
  cuenta_pago         VARCHAR(255),
  documentos_completo BOOLEAN NOT NULL DEFAULT FALSE,
  notas               TEXT,
  tariff_per_minute   NUMERIC(10,4) NOT NULL CHECK (tariff_per_minute >= 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Roster filtering indexes
CREATE INDEX IF NOT EXISTS idx_interpreters_status ON interpreters(status);
CREATE INDEX IF NOT EXISTS idx_interpreters_pais ON interpreters(pais);
CREATE INDEX IF NOT EXISTS idx_interpreters_created ON interpreters(created_at);
CREATE INDEX IF NOT EXISTS idx_interpreters_realtime ON interpreters(realtime_status);

-- Add FK from user_profiles to interpreters
ALTER TABLE user_profiles
  ADD CONSTRAINT fk_user_interpreter
  FOREIGN KEY (interpreter_id) REFERENCES interpreters(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_interpreter 
  ON user_profiles(interpreter_id) WHERE interpreter_id IS NOT NULL;

-- 2.3 ACCOUNTS (Client accounts with custom rates)
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 INTERPRETER-ACCOUNT RATES (Per-account tariff overrides)
CREATE TABLE IF NOT EXISTS interpreter_account_rates (
  id              SERIAL PRIMARY KEY,
  interpreter_id  INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  tariff_per_hour NUMERIC(10,4) NOT NULL CHECK (tariff_per_hour >= 0),
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE,  -- NULL = currently active
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(interpreter_id, account_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_acct_rates_interp ON interpreter_account_rates(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_acct_rates_account ON interpreter_account_rates(account_id);

-- ============================================================
-- 3. PRODUCTION TRACKING MODULE
-- ============================================================

-- 3.1 PRODUCTION LOGS (CSV-imported shift records)
CREATE TABLE IF NOT EXISTS production_logs (
  id                  SERIAL PRIMARY KEY,
  interpreter_id      INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  account_id          INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  date                DATE NOT NULL,
  campaign            VARCHAR(255),
  scheduled_hours     VARCHAR(50),
  login_time          TIMESTAMPTZ,
  logout_time         TIMESTAMPTZ,
  connected_hours     NUMERIC(10,2) CHECK (connected_hours >= 0),
  interpreted_minutes INTEGER NOT NULL DEFAULT 0 CHECK (interpreted_minutes >= 0),
  calls_attended      INTEGER NOT NULL DEFAULT 0 CHECK (calls_attended >= 0),
  adherence           NUMERIC(5,2) CHECK (adherence >= 0 AND adherence <= 100),
  status              log_entry_status NOT NULL DEFAULT 'Completed',
  observaciones       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Critical payroll query indexes
CREATE INDEX IF NOT EXISTS idx_prodlogs_date ON production_logs(date);
CREATE INDEX IF NOT EXISTS idx_prodlogs_interp_date ON production_logs(interpreter_id, date);
CREATE INDEX IF NOT EXISTS idx_prodlogs_status ON production_logs(status);
CREATE INDEX IF NOT EXISTS idx_prodlogs_account ON production_logs(account_id);
-- Covering index for payroll aggregation
CREATE INDEX IF NOT EXISTS idx_prodlogs_payroll_cover 
  ON production_logs(interpreter_id, date, interpreted_minutes, account_id);

-- 3.2 CALL SESSIONS (Real-time tracked calls)
CREATE TABLE IF NOT EXISTS call_sessions (
  id                SERIAL PRIMARY KEY,
  interpreter_id    INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INTEGER CHECK (duration_seconds >= 0),
  tariff_snapshot   NUMERIC(10,4) NOT NULL,
  call_cost         NUMERIC(10,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_interp ON call_sessions(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_calls_started ON call_sessions(started_at);
-- Covering index for payroll
CREATE INDEX IF NOT EXISTS idx_calls_payroll_cover
  ON call_sessions(interpreter_id, started_at, duration_seconds, call_cost)
  WHERE ended_at IS NOT NULL;

-- ============================================================
-- 4. QUALITY ASSURANCE MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS qa_scores (
  id                   SERIAL PRIMARY KEY,
  production_log_id    INTEGER NOT NULL UNIQUE REFERENCES production_logs(id) ON DELETE CASCADE,
  interpreter_id       INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  audit_date           TIMESTAMPTZ NOT NULL,
  auditor              VARCHAR(255),
  auditor_clerk_id     VARCHAR(255),  -- Links to Clerk user who audited
  call_duration        INTEGER CHECK (call_duration > 0),
  call_type            VARCHAR(100),
  protocol_score       NUMERIC(5,2) CHECK (protocol_score >= 0 AND protocol_score <= 100),
  interpretation_score NUMERIC(5,2) CHECK (interpretation_score >= 0 AND interpretation_score <= 100),
  language_score       NUMERIC(5,2) CHECK (language_score >= 0 AND language_score <= 100),
  service_score        NUMERIC(5,2) CHECK (service_score >= 0 AND service_score <= 100),
  technical_score      NUMERIC(5,2) CHECK (technical_score >= 0 AND technical_score <= 100),
  total_score          NUMERIC(5,2) CHECK (total_score >= 0 AND total_score <= 100),
  critical_error       BOOLEAN NOT NULL DEFAULT FALSE,
  comentarios          TEXT,
  accion_requerida     qa_action DEFAULT 'Ninguna',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_audit_date ON qa_scores(audit_date);
CREATE INDEX IF NOT EXISTS idx_qa_interpreter ON qa_scores(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_qa_total_score ON qa_scores(interpreter_id, total_score);

-- ============================================================
-- 5. PAYROLL & BILLING MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_records (
  id                 VARCHAR(30) PRIMARY KEY,  -- CUID
  period_start       DATE NOT NULL,
  period_end         DATE NOT NULL,
  interpreter_id     INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  total_minutes      INTEGER NOT NULL CHECK (total_minutes >= 0),
  gross_total        NUMERIC(10,2) NOT NULL CHECK (gross_total >= 0),
  quality_bonus      NUMERIC(10,2) NOT NULL DEFAULT 0,
  penalidades        NUMERIC(10,2) NOT NULL DEFAULT 0,
  transfer_deduction NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_total          NUMERIC(10,2) NOT NULL,
  status             payroll_status NOT NULL DEFAULT 'Pendiente',
  approved_by        VARCHAR(255),             -- Clerk ID of approver
  payment_date       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_interp ON payroll_records(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_interp_period 
  ON payroll_records(interpreter_id, period_start, period_end);

-- ============================================================
-- 6. RECRUITMENT MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  email             CITEXT NOT NULL UNIQUE,
  telefono          VARCHAR(30),
  pais              VARCHAR(100),
  fuente            VARCHAR(100),
  english_level     VARCHAR(10),
  speedtest_mbps    INTEGER CHECK (speedtest_mbps > 0),
  status            candidate_status NOT NULL DEFAULT 'Aplicante',
  fecha_postulacion DATE NOT NULL,
  fecha_entrevista  TIMESTAMPTZ,
  result_roleplay   INTEGER CHECK (result_roleplay >= 0 AND result_roleplay <= 100),
  fecha_oferta      TIMESTAMPTZ,
  fecha_inicio      TIMESTAMPTZ,
  responsable       VARCHAR(255),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruit_status ON recruitment_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruit_fecha ON recruitment_candidates(fecha_postulacion);

-- ============================================================
-- 7. SYSTEM & AUDIT TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS system_configs (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(255) NOT NULL UNIQUE,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS payrate_audit_log (
  id              SERIAL PRIMARY KEY,
  interpreter_id  INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  old_rate        NUMERIC(10,4),
  new_rate        NUMERIC(10,4) NOT NULL,
  changed_by      VARCHAR(255) NOT NULL,  -- Clerk user ID
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payrate_audit_interp ON payrate_audit_log(interpreter_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(30) PRIMARY KEY,  -- CUID
  user_id    VARCHAR(255) NOT NULL,    -- Clerk user ID
  title      VARCHAR(500) NOT NULL,
  message    TEXT NOT NULL,
  type       notification_type NOT NULL DEFAULT 'info',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================================
-- 8. DATABASE FUNCTIONS (Payroll aggregation in DB)
-- ============================================================

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
DO $$ 
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'user_profiles','interpreters','accounts',
    'interpreter_account_rates','recruitment_candidates','system_configs'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%s_updated_at ON %s;
      CREATE TRIGGER trg_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;

-- Payroll aggregation function (runs in DB, not in serverless function memory)
CREATE OR REPLACE FUNCTION fn_aggregate_payroll(
  p_interpreter_id INTEGER,
  p_start DATE,
  p_end DATE
) RETURNS TABLE(
  imported_minutes  BIGINT,
  realtime_minutes  BIGINT,
  imported_cost     NUMERIC,
  realtime_cost     NUMERIC,
  avg_qa_score      NUMERIC,
  critical_errors   BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pl.total_mins, 0)::BIGINT,
    COALESCE(cs.total_mins, 0)::BIGINT,
    COALESCE(pl.total_cost, 0)::NUMERIC,
    COALESCE(cs.total_cost, 0)::NUMERIC,
    COALESCE(qa.avg_score, 0)::NUMERIC,
    COALESCE(qa.crit_count, 0)::BIGINT
  FROM
    (SELECT 
       SUM(interpreted_minutes) AS total_mins,
       SUM(interpreted_minutes * i.tariff_per_minute) AS total_cost
     FROM production_logs pl2
     JOIN interpreters i ON i.id = pl2.interpreter_id
     WHERE pl2.interpreter_id = p_interpreter_id
       AND pl2.date BETWEEN p_start AND p_end
    ) pl,
    (SELECT
       ROUND(SUM(duration_seconds) / 60.0) AS total_mins,
       SUM(call_cost) AS total_cost
     FROM call_sessions
     WHERE interpreter_id = p_interpreter_id
       AND started_at >= p_start::TIMESTAMPTZ
       AND started_at <= (p_end + INTERVAL '1 day')::TIMESTAMPTZ
       AND ended_at IS NOT NULL
    ) cs,
    (SELECT
       AVG(total_score) AS avg_score,
       COUNT(*) FILTER (WHERE critical_error = TRUE) AS crit_count
     FROM qa_scores
     WHERE interpreter_id = p_interpreter_id
       AND audit_date >= p_start::TIMESTAMPTZ
       AND audit_date <= (p_end + INTERVAL '1 day')::TIMESTAMPTZ
    ) qa;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
