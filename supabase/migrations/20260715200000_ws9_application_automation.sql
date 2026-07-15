ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'NEEDS_INFORMATION';
ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';
ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'BLOCKED_CAPTCHA';
ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'BLOCKED_LOGIN';
ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'UNSUPPORTED';
ALTER TYPE public.application_status
  ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Prevent concurrent/replayed delivery from creating two active tasks for one
-- application and operation. Terminal deliveries remain available as history.
CREATE UNIQUE INDEX IF NOT EXISTS browser_tasks_active_delivery_unique
  ON public.browser_tasks(user_id, application_id, type)
  WHERE application_id IS NOT NULL
    AND status IN ('pending', 'running');
