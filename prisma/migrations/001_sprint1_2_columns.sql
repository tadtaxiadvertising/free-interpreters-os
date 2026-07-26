-- ==============================================================
-- Free Interpreters OS — Sprint 1/2: Migration columnas faltantes
-- Pegar en Supabase Dashbooard → SQL Editor → New Query → Run
-- ==============================================================

BEGIN;

-- 1. Agregar columnas faltantes a interpreters
ALTER TABLE public.interpreters
  ADD COLUMN IF NOT EXISTS status_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_online_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_offline_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Crear tabla de log de cambios de estado
CREATE TABLE IF NOT EXISTS public.interpreter_status_logs (
  id BIGSERIAL PRIMARY KEY,
  interpreter_id BIGINT NOT NULL REFERENCES public.interpreters(id) ON DELETE CASCADE,
  previous_status TEXT DEFAULT NULL,
  new_status TEXT NOT NULL,
  reason TEXT DEFAULT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT NULL
);

-- 3. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID DEFAULT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  category TEXT DEFAULT 'general',
  link TEXT DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_interpreters_realtime_status
  ON public.interpreters(realtime_status);
CREATE INDEX IF NOT EXISTS idx_interpreters_status_changed_at
  ON public.interpreters(status_changed_at);
CREATE INDEX IF NOT EXISTS idx_interpreters_last_heartbeat
  ON public.interpreters(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_interpreter_status_logs_interpreter_id
  ON public.interpreter_status_logs(interpreter_id);
CREATE INDEX IF NOT EXISTS idx_interpreter_status_logs_created_at
  ON public.interpreter_status_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
  ON public.notifications(is_read);

-- 5. Habilitar RLS (opcional, descomentar si se necesita)
-- ALTER TABLE public.interpreter_status_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ==============================================================
-- Post-migration: actualizar interpretes existentes con valores default
-- ==============================================================
UPDATE public.interpreters
SET
  status_reason = CASE
    WHEN realtime_status = 'Online' THEN 'user_online'
    WHEN realtime_status = 'Offline' THEN 'initial'
    WHEN realtime_status = 'Busy' THEN 'call_active'
    WHEN realtime_status = 'Away' THEN 'idle'
    ELSE 'unknown'
  END,
  status_changed_at = updated_at,
  last_activity = updated_at,
  last_online_at = CASE WHEN realtime_status = 'Online' THEN updated_at ELSE NULL END,
  last_offline_at = CASE WHEN realtime_status = 'Offline' THEN updated_at ELSE NULL END
WHERE status_changed_at IS NULL;