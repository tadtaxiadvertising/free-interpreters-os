-- ============================================================
-- Migration V2: Real-Time CRM Features
-- Auth profiles, call sessions, payrate audit, interpreter status
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. User Profiles (bridges auth.users → app roles)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'interpreter' CHECK (role IN ('admin', 'interpreter')),
  interpreter_id  INT REFERENCES public.interpreters(id) ON DELETE SET NULL,
  display_name    TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_interpreter ON public.user_profiles(interpreter_id);

-- 2. Add realtime_status column to interpreters
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interpreters' AND column_name = 'realtime_status'
  ) THEN
    ALTER TABLE public.interpreters
      ADD COLUMN realtime_status TEXT NOT NULL DEFAULT 'Offline'
        CHECK (realtime_status IN ('Online', 'Offline', 'Busy'));
  END IF;
END $$;

-- 3. Call Sessions (timer + billing core)
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id                BIGSERIAL PRIMARY KEY,
  interpreter_id    INT NOT NULL REFERENCES public.interpreters(id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INT GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INT
      ELSE NULL
    END
  ) STORED,
  tariff_snapshot   NUMERIC(10,2) NOT NULL,
  call_cost         NUMERIC(10,2) GENERATED ALWAYS AS (
    CASE WHEN ended_at IS NOT NULL
      THEN ROUND((EXTRACT(EPOCH FROM (ended_at - started_at)) / 60.0) * tariff_snapshot, 2)
      ELSE NULL
    END
  ) STORED,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_interpreter ON public.call_sessions(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started ON public.call_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_active ON public.call_sessions(interpreter_id)
  WHERE ended_at IS NULL;

-- 4. Payrate Audit Log
CREATE TABLE IF NOT EXISTS public.payrate_audit_log (
  id                BIGSERIAL PRIMARY KEY,
  interpreter_id    INT NOT NULL REFERENCES public.interpreters(id) ON DELETE CASCADE,
  old_rate          NUMERIC(10,2),
  new_rate          NUMERIC(10,2) NOT NULL,
  changed_by        UUID NOT NULL REFERENCES auth.users(id),
  changed_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- 5. RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins read all profiles"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- 6. RLS on interpreters (add policies, keep existing data accessible)
ALTER TABLE public.interpreters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access interpreters"
  ON public.interpreters FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

CREATE POLICY "Interpreters read own record"
  ON public.interpreters FOR SELECT
  USING (
    id = (SELECT interpreter_id FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Interpreters update own status"
  ON public.interpreters FOR UPDATE
  USING (
    id = (SELECT interpreter_id FROM public.user_profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    id = (SELECT interpreter_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- 7. RLS on call_sessions
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all calls"
  ON public.call_sessions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

CREATE POLICY "Interpreters manage own calls"
  ON public.call_sessions FOR ALL
  USING (
    interpreter_id = (SELECT interpreter_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- 8. RLS on payrate_audit_log
ALTER TABLE public.payrate_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log"
  ON public.payrate_audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

CREATE POLICY "Admins insert audit log"
  ON public.payrate_audit_log FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  );

-- ============================================================
-- HELPER: Auto-create user_profile on signup (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'interpreter'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
