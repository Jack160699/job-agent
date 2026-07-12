CREATE TABLE IF NOT EXISTS browser_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID,
  type TEXT NOT NULL,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INT NOT NULL DEFAULT 0,
  payload JSONB,
  result JSONB,
  error TEXT,
  screenshot_paths TEXT[] NOT NULL DEFAULT '{}',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  cancelled_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS browser_tasks_status_scheduled_idx ON browser_tasks(status, scheduled_at);
CREATE INDEX IF NOT EXISTS browser_tasks_user_status_idx ON browser_tasks(user_id, status);
