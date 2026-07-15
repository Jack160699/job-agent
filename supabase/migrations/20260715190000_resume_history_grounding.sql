ALTER TABLE public.tailored_resumes
  ADD COLUMN IF NOT EXISTS source_master_version INTEGER,
  ADD COLUMN IF NOT EXISTS source_master_title TEXT,
  ADD COLUMN IF NOT EXISTS source_master_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS grounding_report JSONB,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS jobs_user_saved_idx
  ON public.jobs(user_id, saved_at);

UPDATE public.tailored_resumes tr
SET
  source_master_version = COALESCE(tr.source_master_version, mr.version),
  source_master_title = COALESCE(tr.source_master_title, mr.title),
  source_master_snapshot = COALESCE(
    tr.source_master_snapshot,
    jsonb_build_object(
      'title', mr.title,
      'version', mr.version,
      'rawText', mr.raw_text,
      'skills', mr.skills
    )
  )
FROM public.master_resume mr
WHERE tr.master_resume_id = mr.id
  AND (
    tr.source_master_version IS NULL
    OR tr.source_master_title IS NULL
    OR tr.source_master_snapshot IS NULL
  );

CREATE INDEX IF NOT EXISTS tailored_resumes_user_archived_idx
  ON public.tailored_resumes(user_id, archived_at);

CREATE TABLE IF NOT EXISTS public.tailored_resume_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tailored_resume_id UUID NOT NULL
    REFERENCES public.tailored_resumes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  raw_text TEXT NOT NULL,
  highlights TEXT[] NOT NULL DEFAULT '{}',
  source_master_version INTEGER,
  source_master_title TEXT,
  source_master_snapshot JSONB,
  grounding_report JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tailored_resume_id, version)
);

CREATE INDEX IF NOT EXISTS tailored_resume_versions_user_created_idx
  ON public.tailored_resume_versions(user_id, created_at DESC);

ALTER TABLE public.tailored_resume_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tailored_resume_versions_owner
  ON public.tailored_resume_versions;
CREATE POLICY tailored_resume_versions_owner
  ON public.tailored_resume_versions
  FOR ALL
  USING (
    user_id = public.current_app_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.tailored_resumes tr
      WHERE tr.id = tailored_resume_versions.tailored_resume_id
        AND tr.user_id = tailored_resume_versions.user_id
    )
  )
  WITH CHECK (
    user_id = public.current_app_user_id()
    AND EXISTS (
      SELECT 1
      FROM public.tailored_resumes tr
      WHERE tr.id = tailored_resume_versions.tailored_resume_id
        AND tr.user_id = tailored_resume_versions.user_id
    )
  );
