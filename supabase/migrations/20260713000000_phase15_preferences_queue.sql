-- Phase 15: preferences + queue reliability
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS excluded_companies TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS willing_to_relocate BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER,
  ADD COLUMN IF NOT EXISTS preferences_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS drive_backup_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_stage TEXT,
  ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_meta JSONB;

CREATE INDEX IF NOT EXISTS background_jobs_status_priority_scheduled_idx
  ON background_jobs (status, priority DESC, scheduled_at ASC);

CREATE INDEX IF NOT EXISTS background_jobs_user_type_status_idx
  ON background_jobs (user_id, type, status);

-- Backfill user_id from payload for existing rows
UPDATE background_jobs
SET user_id = (payload->>'userId')::uuid
WHERE user_id IS NULL AND payload->>'userId' IS NOT NULL;

-- Cancel stale interactive backlog and recover stuck running jobs
UPDATE background_jobs
SET status = 'cancelled', cancelled_at = now(), error = 'Archived stale queue entry (Phase 15 cleanup)'
WHERE status = 'pending'
  AND source = 'scheduled'
  AND type IN ('SEARCH_JOBS', 'RUN_AGENT')
  AND created_at < now() - interval '24 hours';

UPDATE background_jobs
SET status = 'pending', scheduled_at = now(), claimed_at = NULL, started_at = NULL, heartbeat_at = NULL,
    error = 'Recovered stale running job (Phase 15)'
WHERE status = 'running'
  AND (heartbeat_at IS NULL OR heartbeat_at < now() - interval '5 minutes')
  AND (started_at IS NULL OR started_at < now() - interval '10 minutes');
