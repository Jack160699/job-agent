-- Job Agent Initial Schema with Row Level Security
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE job_source AS ENUM (
  'LINKEDIN', 'WELLFOUND', 'NAUKRI', 'INDEED',
  'GREENHOUSE', 'LEVER', 'ASHBY', 'COMPANY_PORTAL', 'OTHER'
);
CREATE TYPE work_mode AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');
CREATE TYPE employment_type AS ENUM (
  'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'UNKNOWN'
);
CREATE TYPE application_status AS ENUM (
  'DISCOVERED', 'ANALYZED', 'MATCHED', 'SKIPPED', 'RESUME_GENERATED',
  'COVER_LETTER_GENERATED', 'PENDING_REVIEW', 'SUBMITTING', 'SUBMITTED',
  'FAILED', 'WITHDRAWN', 'INTERVIEWING', 'OFFERED', 'REJECTED', 'ACCEPTED'
);
CREATE TYPE interview_status AS ENUM (
  'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'
);
CREATE TYPE email_direction AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'AUDIT');
CREATE TYPE job_status AS ENUM ('ACTIVE', 'CLOSED', 'EXPIRED', 'ARCHIVED');

-- Users table (synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  supabase_id UUID UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_resume (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Master Resume',
  content JSONB NOT NULL DEFAULT '{}',
  raw_text TEXT NOT NULL DEFAULT '',
  skills TEXT[] DEFAULT '{}',
  experience JSONB,
  education JSONB,
  projects JSONB,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT,
  source job_source NOT NULL,
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_size TEXT,
  location TEXT,
  work_mode work_mode DEFAULT 'UNKNOWN',
  employment_type employment_type DEFAULT 'UNKNOWN',
  salary_min INT,
  salary_max INT,
  salary_currency TEXT DEFAULT 'USD',
  visa_sponsorship BOOLEAN,
  description TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  experience_min INT,
  experience_max INT,
  match_score FLOAT,
  match_analysis JSONB,
  status job_status DEFAULT 'ACTIVE',
  posted_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source, external_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status application_status DEFAULT 'DISCOVERED',
  match_score FLOAT,
  auto_submit BOOLEAN DEFAULT FALSE,
  requires_review BOOLEAN DEFAULT TRUE,
  submitted_at TIMESTAMPTZ,
  form_data JSONB,
  documents JSONB,
  notes TEXT,
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

CREATE TABLE IF NOT EXISTS tailored_resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  master_resume_id UUID NOT NULL REFERENCES master_resume(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  application_id UUID UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL,
  raw_text TEXT NOT NULL,
  match_score FLOAT,
  highlights TEXT[] DEFAULT '{}',
  file_url TEXT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  application_id UUID UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tone TEXT DEFAULT 'professional',
  file_url TEXT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recruiters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  linkedin_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT,
  status interview_status DEFAULT 'SCHEDULED',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT DEFAULT 60,
  location TEXT,
  meeting_url TEXT,
  calendar_id TEXT,
  notes TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES recruiters(id) ON DELETE SET NULL,
  gmail_id TEXT UNIQUE,
  thread_id TEXT,
  direction email_direction NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_titles TEXT[] DEFAULT '{}',
  experience_years INT,
  salary_min INT,
  salary_max INT,
  salary_currency TEXT DEFAULT 'USD',
  work_modes work_mode[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  visa_sponsorship_required BOOLEAN DEFAULT FALSE,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  company_sizes TEXT[] DEFAULT '{}',
  employment_types employment_type[] DEFAULT '{}',
  match_threshold FLOAT DEFAULT 70,
  auto_submit_enabled BOOLEAN DEFAULT FALSE,
  auto_submit_sources job_source[] DEFAULT '{}',
  require_review BOOLEAN DEFAULT TRUE,
  enabled_sources job_source[] DEFAULT ARRAY['LINKEDIN','INDEED','GREENHOUSE','LEVER','ASHBY']::job_source[],
  search_frequency_hours INT DEFAULT 6,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  sheets_sync_enabled BOOLEAN DEFAULT FALSE,
  sheets_id TEXT,
  calendar_sync_enabled BOOLEAN DEFAULT FALSE,
  gmail_sync_enabled BOOLEAN DEFAULT FALSE,
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  level log_level DEFAULT 'INFO',
  action TEXT NOT NULL,
  resource TEXT,
  resource_id TEXT,
  message TEXT NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error TEXT,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_match ON jobs(user_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_status ON applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_logs_user_created ON logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_interviews_user_scheduled ON interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_emails_user_received ON emails(user_id, received_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER master_resume_updated_at BEFORE UPDATE ON master_resume FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_resume ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tailored_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY users_select_own ON users FOR SELECT USING (supabase_id = auth.uid());
CREATE POLICY users_update_own ON users FOR UPDATE USING (supabase_id = auth.uid());

CREATE POLICY master_resume_all ON master_resume FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY jobs_all ON jobs FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY applications_all ON applications FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY tailored_resumes_all ON tailored_resumes FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY cover_letters_all ON cover_letters FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY recruiters_all ON recruiters FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY interviews_all ON interviews FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY emails_all ON emails FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY settings_all ON settings FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY logs_select ON logs FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

CREATE POLICY secrets_all ON encrypted_secrets FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE supabase_id = auth.uid()));

-- Service role bypass for background jobs (no RLS on background_jobs)
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY background_jobs_service ON background_jobs FOR ALL USING (true);
