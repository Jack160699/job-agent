-- Grounded proactive career recommendations and user controls.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS disabled_recommendation_categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.proactive_recommendations
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'career',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS suggested_action TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.proactive_recommendations
  DROP CONSTRAINT IF EXISTS proactive_recommendations_priority_check;
ALTER TABLE public.proactive_recommendations
  ADD CONSTRAINT proactive_recommendations_priority_check
  CHECK (priority IN ('low', 'medium', 'high'));

ALTER TABLE public.proactive_recommendations
  DROP CONSTRAINT IF EXISTS proactive_recommendations_status_check;
ALTER TABLE public.proactive_recommendations
  ADD CONSTRAINT proactive_recommendations_status_check
  CHECK (status IN ('active', 'snoozed', 'dismissed', 'done', 'expired'));

CREATE INDEX IF NOT EXISTS proactive_recommendations_category_status_idx
  ON public.proactive_recommendations(user_id, category, status);
CREATE INDEX IF NOT EXISTS proactive_recommendations_expiry_idx
  ON public.proactive_recommendations(expires_at)
  WHERE expires_at IS NOT NULL;

-- The application user id is not the Supabase auth id. Bind through users.supabase_id.
DROP POLICY IF EXISTS proactive_recommendations_user_policy
  ON public.proactive_recommendations;
CREATE POLICY proactive_recommendations_user_policy
  ON public.proactive_recommendations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = proactive_recommendations.user_id
        AND users.supabase_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = proactive_recommendations.user_id
        AND users.supabase_id = auth.uid()
    )
  );
