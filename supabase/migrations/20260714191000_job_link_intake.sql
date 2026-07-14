CREATE TABLE IF NOT EXISTS public.job_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  normalized_url TEXT NOT NULL,
  url_hash TEXT NOT NULL,
  source public.job_source,
  status TEXT NOT NULL DEFAULT 'pending',
  extraction_method TEXT,
  extractor_version TEXT NOT NULL DEFAULT 'v1',
  extracted_data JSONB,
  manual_description TEXT,
  error_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  corrected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_imports_user_url_hash_key UNIQUE (user_id, url_hash)
);

CREATE INDEX IF NOT EXISTS job_imports_user_status_created_idx
  ON public.job_imports(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_imports_job_id_idx
  ON public.job_imports(job_id);

DROP TRIGGER IF EXISTS job_imports_updated_at ON public.job_imports;
CREATE TRIGGER job_imports_updated_at
  BEFORE UPDATE ON public.job_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.job_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_imports_user_policy ON public.job_imports;
CREATE POLICY job_imports_user_policy
  ON public.job_imports
  FOR ALL
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM public.users WHERE supabase_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM public.users WHERE supabase_id = auth.uid()
    )
  );
