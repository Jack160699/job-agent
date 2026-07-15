-- Speed up per-user/application active task deduplication.
CREATE INDEX IF NOT EXISTS browser_tasks_application_active_idx
  ON public.browser_tasks(user_id, application_id, type, status)
  WHERE application_id IS NOT NULL
    AND status IN ('pending', 'running');
