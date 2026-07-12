-- Phase 2: Role-based onboarding models

CREATE TYPE user_persona AS ENUM (
  'JOB_SEEKER', 'EMPLOYER', 'RECRUITER', 'AGENCY', 'EXPLORER'
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS persona user_persona NOT NULL DEFAULT 'JOB_SEEKER',
  ADD COLUMN IF NOT EXISTS current_location TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS profile_current_role TEXT,
  ADD COLUMN IF NOT EXISTS current_salary INT;

CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step TEXT NOT NULL DEFAULT 'welcome',
  completed_steps TEXT[] DEFAULT '{}',
  draft_data JSONB,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  completion_pct INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hiring_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT,
  company_size TEXT,
  hiring_goal TEXT,
  user_role TEXT,
  roles_hired TEXT[] DEFAULT '{}',
  hiring_volume TEXT,
  locations TEXT[] DEFAULT '{}',
  team_members INT,
  preferred_sources TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preference_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  changed_fields TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preference_history_user_version
  ON preference_history(user_id, version);

CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_type
  ON consent_records(user_id, consent_type);

-- RLS
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE preference_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY onboarding_state_user_policy ON onboarding_state
  FOR ALL USING (user_id = auth.uid()::uuid);

CREATE POLICY hiring_profiles_user_policy ON hiring_profiles
  FOR ALL USING (user_id = auth.uid()::uuid);

CREATE POLICY preference_history_user_policy ON preference_history
  FOR ALL USING (user_id = auth.uid()::uuid);

CREATE POLICY consent_records_user_policy ON consent_records
  FOR ALL USING (user_id = auth.uid()::uuid);
