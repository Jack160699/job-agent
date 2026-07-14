-- Browser tasks contain application payloads and screenshots. Restrict direct
-- Data API access to the authenticated owner; service-role workers bypass RLS.
ALTER TABLE public.browser_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS browser_tasks_user_policy ON public.browser_tasks;
CREATE POLICY browser_tasks_user_policy
  ON public.browser_tasks
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

-- The service role already bypasses RLS. A USING (true) policy exposed the
-- complete queue through PostgREST to every role.
DROP POLICY IF EXISTS background_jobs_service ON public.background_jobs;

-- Pin the function search path to prevent object-shadowing attacks.
ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp;
