ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS description_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS jobs_user_canonical_url_idx
  ON public.jobs(user_id, canonical_url);
CREATE INDEX IF NOT EXISTS jobs_user_description_fingerprint_idx
  ON public.jobs(user_id, description_fingerprint);

CREATE TABLE IF NOT EXISTS public.search_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  plan JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_plans_user_created_idx
  ON public.search_plans(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.job_source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source public.job_source NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  successful_responses INTEGER NOT NULL DEFAULT 0,
  empty_responses INTEGER NOT NULL DEFAULT 0,
  invalid_jobs INTEGER NOT NULL DEFAULT 0,
  duplicate_jobs INTEGER NOT NULL DEFAULT 0,
  expired_jobs INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  relevance_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  relevance_samples INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_successful_fetch TIMESTAMPTZ,
  disabled_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

CREATE INDEX IF NOT EXISTS job_source_health_user_disabled_idx
  ON public.job_source_health(user_id, disabled_until);

CREATE TABLE IF NOT EXISTS public.job_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  source public.job_source NOT NULL,
  source_url TEXT NOT NULL,
  external_id TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, source_url)
);

CREATE INDEX IF NOT EXISTS job_provenance_job_idx
  ON public.job_provenance(job_id);

ALTER TABLE public.search_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_provenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_plans_owner ON public.search_plans;
CREATE POLICY search_plans_owner ON public.search_plans
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS job_source_health_owner ON public.job_source_health;
CREATE POLICY job_source_health_owner ON public.job_source_health
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS job_provenance_owner ON public.job_provenance;
CREATE POLICY job_provenance_owner ON public.job_provenance
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());
