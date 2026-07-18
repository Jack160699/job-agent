-- Phase D (Performance, ATS Intelligence, and Job Search Reliability V1):
-- persists the exact before/after Kairela Job ATS Match scores, the exact
-- submitted resume document, and submission timestamp for every
-- application — displayed in Applications, Resume History, Job detail, and
-- Application detail. A dedicated table (not JSON piggybacked onto
-- tailored_resumes) so this history is queryable and cannot be silently
-- overwritten by unrelated tailored-resume updates.
--
-- FORWARD-ONLY. Does not modify any previously applied migration.
-- NOT applied to any remote database by this change — see
-- docs/progress/PERFORMANCE_ATS_SEARCH_V1_IMPLEMENTATION.md for status.

CREATE TABLE IF NOT EXISTS public.application_score_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL UNIQUE
    REFERENCES public.applications(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_description_fingerprint TEXT,
  master_resume_version INTEGER NOT NULL,
  tailored_resume_id UUID NOT NULL
    REFERENCES public.tailored_resumes(id) ON DELETE CASCADE,
  tailored_resume_version INTEGER NOT NULL,
  original_score INTEGER NOT NULL,
  original_breakdown JSONB NOT NULL,
  tailored_score INTEGER NOT NULL,
  tailored_breakdown JSONB NOT NULL,
  score_delta INTEGER NOT NULL,
  missing_requirements TEXT[] NOT NULL DEFAULT '{}',
  grounding_exclusions JSONB,
  submitted_document TEXT,
  submitted_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_score_records_user_job_idx
  ON public.application_score_records(user_id, job_id);

CREATE INDEX IF NOT EXISTS application_score_records_user_created_idx
  ON public.application_score_records(user_id, created_at DESC);

ALTER TABLE public.application_score_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_score_records_owner
  ON public.application_score_records;
CREATE POLICY application_score_records_owner
  ON public.application_score_records
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());
