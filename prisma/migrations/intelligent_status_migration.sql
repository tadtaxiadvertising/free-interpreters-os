-- Migration: Add intelligent status tracking fields
-- Run: npx prisma db push OR apply via Supabase SQL Editor
-- 
-- Changes:
--   1. Add status tracking fields to interpreters table
--   2. Create interpreter_status_logs table for audit trail

-- ── Step 1: Add columns to interpreters ──

ALTER TABLE public.interpreters
  ADD COLUMN IF NOT EXISTS status_reason          TEXT        DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS last_heartbeat         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_online_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_offline_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS browser_tab_id         TEXT,
  ADD COLUMN IF NOT EXISTS client_ip              TEXT;

CREATE INDEX IF NOT EXISTS idx_interpreters_realtime_status ON public.interpreters (realtime_status);
CREATE INDEX IF NOT EXISTS idx_interpreters_last_heartbeat ON public.interpreters (last_heartbeat);

-- ── Step 2: Create status log table ──

CREATE TABLE IF NOT EXISTS public.interpreter_status_logs (
  id              SERIAL       PRIMARY KEY,
  interpreter_id  INTEGER      NOT NULL REFERENCES public.interpreters(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status      TEXT         NOT NULL,
  reason          TEXT         NOT NULL DEFAULT 'manual',
  changed_by      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_logs_interpreter_time
  ON public.interpreter_status_logs (interpreter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_logs_created_at
  ON public.interpreter_status_logs (created_at);

-- ── Init: set status_reason for all existing records ──
UPDATE public.interpreters
SET status_reason = CASE
  WHEN realtime_status IS NULL OR realtime_status = 'Offline' THEN 'initial'
  WHEN realtime_status = 'Online' THEN 'user_online'
  WHEN realtime_status = 'Busy' THEN 'call_started'
  ELSE 'initial'
END
WHERE status_reason IS NULL;

-- ── Step 3: Add category to notifications ──

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications (category);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at);