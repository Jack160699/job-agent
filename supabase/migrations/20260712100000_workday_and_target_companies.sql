-- Add WORKDAY job source and target companies for board search
ALTER TYPE job_source ADD VALUE IF NOT EXISTS 'WORKDAY';

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS target_companies TEXT[] DEFAULT '{}';
