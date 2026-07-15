CREATE TABLE IF NOT EXISTS public.job_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  relevant BOOLEAN NOT NULL,
  reason TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_feedback_user_job_unique UNIQUE (user_id, job_id),
  CONSTRAINT job_feedback_reason_check CHECK (
    reason IS NULL OR reason IN (
      'good_match',
      'wrong_role',
      'wrong_location',
      'wrong_seniority',
      'wrong_salary',
      'wrong_work_mode',
      'not_interested',
      'misleading_posting',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS job_feedback_user_relevance_idx
  ON public.job_feedback(user_id, relevant, updated_at DESC);

ALTER TABLE public.job_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_feedback_user_policy
  ON public.job_feedback
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = job_feedback.user_id
        AND users.supabase_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = job_feedback.user_id
        AND users.supabase_id = auth.uid()
    )
  );
