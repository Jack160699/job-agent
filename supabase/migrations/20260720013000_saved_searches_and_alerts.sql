-- Forward-only saved-search and scheduled-alert persistence.
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  titles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  locations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sector TEXT NOT NULL,
  government_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  filters JSONB NOT NULL DEFAULT '{}'::JSONB,
  search_stage TEXT NOT NULL DEFAULT 'strict',
  sources public.job_source[] NOT NULL DEFAULT ARRAY[]::public.job_source[],
  alert_frequency TEXT NOT NULL DEFAULT 'OFF'
    CHECK (alert_frequency IN ('OFF', 'DAILY', 'WEEKLY')),
  alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT saved_searches_user_name_key UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS saved_searches_alerts_next_run_idx
  ON public.saved_searches (alerts_enabled, next_run_at);
CREATE INDEX IF NOT EXISTS saved_searches_user_created_idx
  ON public.saved_searches (user_id, created_at DESC);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_searches_owner_select ON public.saved_searches;
CREATE POLICY saved_searches_owner_select ON public.saved_searches
  FOR SELECT USING (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS saved_searches_owner_insert ON public.saved_searches;
CREATE POLICY saved_searches_owner_insert ON public.saved_searches
  FOR INSERT WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS saved_searches_owner_update ON public.saved_searches;
CREATE POLICY saved_searches_owner_update ON public.saved_searches
  FOR UPDATE
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS saved_searches_owner_delete ON public.saved_searches;
CREATE POLICY saved_searches_owner_delete ON public.saved_searches
  FOR DELETE USING (user_id = public.current_app_user_id());

CREATE OR REPLACE FUNCTION public.touch_saved_search_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_saved_searches_updated_at ON public.saved_searches;
CREATE TRIGGER set_saved_searches_updated_at
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_saved_search_updated_at();
