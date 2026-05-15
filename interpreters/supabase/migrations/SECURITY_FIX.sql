-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY_FIX.SQL — Free Interpreters OS
-- Run this in the Supabase SQL Editor to resolve all Security Advisor warnings.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Fix Search Path for utility functions (Prevents hijacking)
ALTER FUNCTION public.calculate_call_metrics() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.calculate_qa_total() SET search_path = public;
ALTER FUNCTION public.aggregate_interpreter_payroll(INTEGER, DATE, DATE) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- 2. Fix get_curr_interpreter_id (Search Path + Permissions)
-- This function is likely defined in the live database but missing from migrations.
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_curr_interpreter_id') THEN
    -- Set Search Path
    ALTER FUNCTION public.get_curr_interpreter_id() SET search_path = public;
    
    -- Secure Execution (Revoke from public/anon, grant to authenticated)
    REVOKE EXECUTE ON FUNCTION public.get_curr_interpreter_id() FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.get_curr_interpreter_id() FROM anon;
    GRANT EXECUTE ON FUNCTION public.get_curr_interpreter_id() TO authenticated, service_role;
    
    RAISE NOTICE 'Fixed public.get_curr_interpreter_id';
  ELSE
    RAISE NOTICE 'public.get_curr_interpreter_id not found, skipping.';
  END IF;
END $$;

-- 3. Fix is_admin (Permissions)
-- Ensure only authenticated users and service_role can call it.
ALTER FUNCTION public.is_admin() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- 4. Fix handle_new_user (Permissions)
-- This is a trigger function, nobody needs to execute it directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 5. Additional hardening for any other SECURITY DEFINER functions
DO $$ 
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT n.nspname as schema, p.proname as name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.prosecdef = true -- SECURITY DEFINER
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = public', func_record.schema, func_record.name);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY FIXES APPLIED ✅
-- ─────────────────────────────────────────────────────────────────────────────
