CREATE TABLE IF NOT EXISTS public.master_resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_resume_id UUID NOT NULL REFERENCES public.master_resume(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  raw_text TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT master_resume_versions_resume_version_unique
    UNIQUE (master_resume_id, version)
);

CREATE INDEX IF NOT EXISTS master_resume_versions_user_created_idx
  ON public.master_resume_versions(user_id, created_at DESC);

ALTER TABLE public.master_resume_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY master_resume_versions_user_policy
  ON public.master_resume_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = master_resume_versions.user_id
        AND users.supabase_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = master_resume_versions.user_id
        AND users.supabase_id = auth.uid()
    )
  );
