-- Harden legacy RLS policies with ownership via users.supabase_id and WITH CHECK.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'master_resume',
        'jobs',
        'applications',
        'tailored_resumes',
        'cover_letters',
        'recruiters',
        'interviews',
        'emails',
        'settings',
        'encrypted_secrets',
        'onboarding_state',
        'hiring_profiles',
        'preference_history',
        'consent_records',
        'consultant_messages',
        'subscriptions',
        'usage_ledger'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id
  FROM public.users
  WHERE supabase_id = auth.uid()::text
  LIMIT 1
$$;

CREATE POLICY master_resume_owner ON public.master_resume
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY jobs_owner ON public.jobs
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY applications_owner ON public.applications
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY tailored_resumes_owner ON public.tailored_resumes
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY cover_letters_owner ON public.cover_letters
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY recruiters_owner ON public.recruiters
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY interviews_owner ON public.interviews
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY emails_owner ON public.emails
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY settings_owner ON public.settings
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY encrypted_secrets_owner ON public.encrypted_secrets
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY onboarding_state_owner ON public.onboarding_state
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY hiring_profiles_owner ON public.hiring_profiles
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY preference_history_owner ON public.preference_history
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY consent_records_owner ON public.consent_records
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY consultant_messages_owner ON public.consultant_messages
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY subscriptions_owner ON public.subscriptions
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY usage_ledger_owner ON public.usage_ledger
  FOR ALL
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());
