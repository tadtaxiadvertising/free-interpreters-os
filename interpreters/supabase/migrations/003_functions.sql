-- ─────────────────────────────────────────────────────────────────────────────
-- 003_FUNCTIONS.SQL — Free Interpreters OS
-- Business logic and automation triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Function: Calculate QA Total Score
-- Automatically calculates total_score based on weighted sub-scores
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
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER trg_calculate_qa_total
BEFORE INSERT OR UPDATE ON public.qa_scores
FOR EACH ROW EXECUTE FUNCTION public.calculate_qa_total();

-- 2. Function: Aggregate Payroll for Period
-- Logic to batch calculate minutes and costs for an interpreter
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
$$ LANGUAGE plpgsql
SET search_path = public;

-- 3. Function: Calculate Call Duration and Cost
-- Automatically calculates duration and cost when a session ends
CREATE OR REPLACE FUNCTION public.calculate_call_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        -- Calculate duration in seconds
        NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
        
        -- Calculate cost (tariff per minute * minutes)
        -- We use CEIL to charge for partial minutes as per standard industry practice
        NEW.call_cost := (CEIL(NEW.duration_seconds::DECIMAL / 60.0)) * NEW.tariff_snapshot;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER trg_calculate_call_metrics
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.calculate_call_metrics();

-- 4. Trigger: Update updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER trg_interpreters_updated_at BEFORE UPDATE ON public.interpreters FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_recruitment_candidates_updated_at BEFORE UPDATE ON public.recruitment_candidates FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_system_configs_updated_at BEFORE UPDATE ON public.system_configs FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
