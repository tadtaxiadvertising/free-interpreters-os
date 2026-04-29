-- Free Interpreters OS - Full Schema Migration (Idempotent)
-- Execute this in Supabase SQL Editor

-- 1. ALTER/CREATE INTERPRETERS TABLE
CREATE TABLE IF NOT EXISTS interpreters (
  id SERIAL PRIMARY KEY,
  "externalId" VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Activo' NOT NULL,
  campaign VARCHAR(255),
  "languageA" VARCHAR(100) DEFAULT 'Español' NOT NULL,
  "languageB" VARCHAR(100) DEFAULT 'Inglés' NOT NULL,
  "emailCorporativo" VARCHAR(255),
  telefono VARCHAR(20),
  pais VARCHAR(100),
  "metodoPago" VARCHAR(50),
  "cuentaPago" VARCHAR(255),
  "documentosCompleto" BOOLEAN DEFAULT FALSE,
  notas TEXT,
  "tariffPerMinute" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to interpreters if they don't exist
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Activo' NOT NULL;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "languageA" VARCHAR(100) DEFAULT 'Español' NOT NULL;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "languageB" VARCHAR(100) DEFAULT 'Inglés' NOT NULL;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "emailCorporativo" VARCHAR(255);
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS pais VARCHAR(100);
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "metodoPago" VARCHAR(50);
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "cuentaPago" VARCHAR(255);
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS "documentosCompleto" BOOLEAN DEFAULT FALSE;
ALTER TABLE interpreters ADD COLUMN IF NOT EXISTS notas TEXT;

CREATE INDEX IF NOT EXISTS idx_interpreters_status ON interpreters(status);
CREATE INDEX IF NOT EXISTS idx_interpreters_pais ON interpreters("pais");
CREATE INDEX IF NOT EXISTS idx_interpreters_createdAt ON interpreters("createdAt");

-- 2. ALTER/CREATE PRODUCTION_LOGS TABLE
CREATE TABLE IF NOT EXISTS production_logs (
  id SERIAL PRIMARY KEY,
  interpreter_id INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  campaign VARCHAR(255),
  scheduled_hours VARCHAR(50),
  login_time TIMESTAMP,
  logout_time TIMESTAMP,
  connected_hours DECIMAL(10, 2),
  interpreted_minutes INTEGER DEFAULT 0 NOT NULL,
  calls_attended INTEGER DEFAULT 0 NOT NULL,
  adherence DECIMAL(5, 2),
  status VARCHAR(50) NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to production_logs
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS campaign VARCHAR(255);
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS scheduled_hours VARCHAR(50);
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS connected_hours DECIMAL(10, 2);
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS status VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_production_logs_date ON production_logs(date);
CREATE INDEX IF NOT EXISTS idx_production_logs_interpreter_date ON production_logs(interpreter_id, date);
CREATE INDEX IF NOT EXISTS idx_production_logs_status ON production_logs(status);

-- 3. CREATE QA_SCORES TABLE
CREATE TABLE IF NOT EXISTS qa_scores (
  id SERIAL PRIMARY KEY,
  production_log_id INTEGER UNIQUE NOT NULL REFERENCES production_logs(id) ON DELETE CASCADE,
  interpreter_id INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  audit_date TIMESTAMP NOT NULL,
  auditor VARCHAR(255),
  call_duration INTEGER,
  call_type VARCHAR(100),
  protocol_score DECIMAL(5, 2),
  interpretation_score DECIMAL(5, 2),
  language_score DECIMAL(5, 2),
  service_score DECIMAL(5, 2),
  technical_score DECIMAL(5, 2),
  total_score DECIMAL(5, 2),
  critical_error BOOLEAN DEFAULT FALSE,
  comentarios TEXT,
  accion_requerida VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qa_scores_audit_date ON qa_scores(audit_date);
CREATE INDEX IF NOT EXISTS idx_qa_scores_interpreter_id ON qa_scores(interpreter_id);

-- 4. ALTER/CREATE PAYROLL_RECORDS TABLE
CREATE TABLE IF NOT EXISTS payroll_records (
  id VARCHAR(255) PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  interpreter_id INTEGER NOT NULL REFERENCES interpreters(id) ON DELETE CASCADE,
  total_minutes INTEGER NOT NULL,
  gross_total DECIMAL(10, 2) NOT NULL,
  quality_bonus DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  penalidades DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  transfer_deduction DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  net_total DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'Pendiente' NOT NULL,
  payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to payroll_records
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pendiente';

CREATE INDEX IF NOT EXISTS idx_payroll_records_period_start_end ON payroll_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_records_interpreter_id ON payroll_records(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);

-- 5. CREATE RECRUITMENT_CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS recruitment_candidates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefono VARCHAR(20),
  pais VARCHAR(100),
  fuente VARCHAR(50),
  "englishLevel" VARCHAR(10),
  "speedtestMbps" INTEGER,
  status VARCHAR(50) DEFAULT 'Aplicante' NOT NULL,
  "fechaPostulacion" DATE NOT NULL,
  "fechaEntrevista" TIMESTAMP,
  "resultRoleplay" INTEGER,
  "fechaOferta" TIMESTAMP,
  "fechaInicio" TIMESTAMP,
  responsable VARCHAR(255),
  notas TEXT,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_status ON recruitment_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_candidates_fechaPostulacion ON recruitment_candidates("fechaPostulacion");

-- 6. Create Prisma migrations table if not exists
CREATE TABLE IF NOT EXISTS _prisma_migrations (
  id VARCHAR(36) PRIMARY KEY,
  checksum VARCHAR(64) NOT NULL,
  finished_at TIMESTAMP,
  migration_name VARCHAR(255) NOT NULL,
  logs TEXT,
  rolled_back_at TIMESTAMP,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_steps_count INTEGER NOT NULL DEFAULT 0
);

-- 7. Enable Row Level Security for future auth integration
ALTER TABLE interpreters ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_candidates ENABLE ROW LEVEL SECURITY;

-- 8. Create or replace function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Add triggers for updatedAt
DROP TRIGGER IF EXISTS update_interpreters_updated_at ON interpreters;
CREATE TRIGGER update_interpreters_updated_at BEFORE UPDATE ON interpreters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recruitment_candidates_updated_at ON recruitment_candidates;
CREATE TRIGGER update_recruitment_candidates_updated_at BEFORE UPDATE ON recruitment_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
