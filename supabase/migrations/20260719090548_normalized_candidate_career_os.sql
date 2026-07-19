-- Kairela normalized Career OS foundation.
-- Forward-only: all legacy resume/profile columns remain available while the
-- application moves section-by-section to the normalized model.

ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'UPSC';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'ISRO';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'NTPC';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'BEL';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'IOCL';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'IBPS';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'RAILWAYS';

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS sector_preference TEXT NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS government_categories TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  professional_headline TEXT,
  professional_summary TEXT,
  suggested_summary TEXT,
  current_job_role TEXT,
  primary_professional_identity TEXT,
  seniority TEXT,
  years_of_experience NUMERIC(5,2),
  availability TEXT,
  notice_period_days INTEGER,
  relocation_preference TEXT,
  work_authorization TEXT,
  completeness_score INTEGER NOT NULL DEFAULT 0 CHECK (completeness_score BETWEEN 0 AND 100),
  review_required_count INTEGER NOT NULL DEFAULT 0 CHECK (review_required_count >= 0),
  legacy_master_resume_id UUID REFERENCES public.master_resume(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_contact_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL UNIQUE REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  job_title TEXT,
  employer TEXT,
  employment_type TEXT,
  location TEXT,
  work_mode TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  achievements TEXT[] NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '[]',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  name TEXT,
  role TEXT,
  description TEXT,
  problem TEXT,
  solution TEXT,
  contributions TEXT[] NOT NULL DEFAULT '{}',
  technologies TEXT[] NOT NULL DEFAULT '{}',
  outcomes TEXT[] NOT NULL DEFAULT '{}',
  metrics JSONB NOT NULL DEFAULT '[]',
  project_url TEXT,
  repository_url TEXT,
  start_date DATE,
  end_date DATE,
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  degree TEXT,
  specialization TEXT,
  institution TEXT,
  location TEXT,
  start_year INTEGER,
  end_year INTEGER,
  grade_type TEXT,
  grade_value TEXT,
  coursework TEXT[] NOT NULL DEFAULT '{}',
  achievements TEXT[] NOT NULL DEFAULT '{}',
  source_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'core',
  proficiency TEXT,
  years_used NUMERIC(5,2),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, normalized_name, category)
);

CREATE TABLE IF NOT EXISTS public.candidate_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  name TEXT NOT NULL,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,
  credential_id TEXT,
  credential_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  proficiency TEXT,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, language)
);

CREATE TABLE IF NOT EXISTS public.candidate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, link_type, url)
);

CREATE TABLE IF NOT EXISTS public.candidate_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL UNIQUE REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  sector_preference TEXT NOT NULL DEFAULT 'both',
  work_modes TEXT[] NOT NULL DEFAULT '{}',
  employment_types TEXT[] NOT NULL DEFAULT '{}',
  preferred_industries TEXT[] NOT NULL DEFAULT '{}',
  excluded_industries TEXT[] NOT NULL DEFAULT '{}',
  excluded_companies TEXT[] NOT NULL DEFAULT '{}',
  minimum_salary INTEGER,
  maximum_salary INTEGER,
  salary_currency TEXT NOT NULL DEFAULT 'INR',
  government_categories TEXT[] NOT NULL DEFAULT '{}',
  alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.candidate_job_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, normalized_title)
);

CREATE TABLE IF NOT EXISTS public.candidate_location_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  is_remote BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.resume_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  master_resume_id UUID REFERENCES public.master_resume(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  original_filename TEXT,
  media_type TEXT,
  storage_path TEXT,
  content_sha256 TEXT,
  byte_size BIGINT,
  raw_text TEXT,
  is_original_preserved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_sha256)
);

CREATE TABLE IF NOT EXISTS public.resume_parse_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resume_source_id UUID NOT NULL REFERENCES public.resume_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  parser_version TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  schema_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.resume_version_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  master_resume_version_id UUID REFERENCES public.master_resume_versions(id) ON DELETE CASCADE,
  tailored_resume_version_id UUID REFERENCES public.tailored_resume_versions(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (master_resume_version_id IS NOT NULL)::integer +
    (tailored_resume_version_id IS NOT NULL)::integer = 1
  )
);

CREATE TABLE IF NOT EXISTS public.profile_field_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.candidate_profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  field_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (
    source_type IN (
      'user_confirmed', 'user_edit', 'onboarding', 'resume_extracted',
      'ai_inferred', 'system_generated', 'answer_bank'
    )
  ),
  source_document_id UUID REFERENCES public.resume_sources(id) ON DELETE SET NULL,
  source_section TEXT,
  confidence NUMERIC(4,3) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  review_status TEXT NOT NULL DEFAULT 'pending',
  confirmation_state TEXT NOT NULL DEFAULT 'unconfirmed',
  modified_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_profile_id, entity_type, entity_id, field_name)
);

CREATE TABLE IF NOT EXISTS public.application_answer_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  answer JSONB NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  confirmation_state TEXT NOT NULL DEFAULT 'unconfirmed',
  confirmed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_key)
);

CREATE TABLE IF NOT EXISTS public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  access_method TEXT NOT NULL,
  canonical_url TEXT,
  status TEXT NOT NULL DEFAULT 'unavailable',
  enabled BOOLEAN NOT NULL DEFAULT false,
  authentication_requirements TEXT,
  rate_limit_policy JSONB NOT NULL DEFAULT '{}',
  limitations TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_source_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  search_context JSONB NOT NULL DEFAULT '{}',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  normalized_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.normalized_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT,
  job_type TEXT NOT NULL DEFAULT 'private',
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  department TEXT,
  location TEXT,
  state TEXT,
  district TEXT,
  country TEXT NOT NULL DEFAULT 'India',
  work_mode TEXT,
  employment_type TEXT,
  description TEXT,
  experience_min NUMERIC(5,2),
  experience_max NUMERIC(5,2),
  salary_min BIGINT,
  salary_max BIGINT,
  salary_currency TEXT NOT NULL DEFAULT 'INR',
  skills TEXT[] NOT NULL DEFAULT '{}',
  qualification TEXT,
  advertisement_number TEXT,
  vacancy_count INTEGER,
  reservation_details JSONB,
  age_criteria TEXT,
  age_relaxation TEXT,
  pay_level TEXT,
  application_fee TEXT,
  selection_process TEXT,
  application_start_date DATE,
  application_deadline TIMESTAMPTZ,
  exam_date DATE,
  notification_url TEXT,
  notification_pdf_url TEXT,
  application_url TEXT,
  status TEXT NOT NULL DEFAULT 'unverified',
  description_fingerprint TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS normalized_jobs_canonical_url_unique
  ON public.normalized_jobs (canonical_url)
  WHERE canonical_url IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS normalized_government_advert_unique
  ON public.normalized_jobs (
    lower(organization), lower(coalesce(advertisement_number, '')),
    lower(title), coalesce(application_deadline, 'infinity'::timestamptz)
  )
  WHERE job_type = 'government' AND advertisement_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.job_source_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.job_sources(id) ON DELETE CASCADE,
  normalized_job_id UUID NOT NULL REFERENCES public.normalized_jobs(id) ON DELETE CASCADE,
  source_run_id UUID REFERENCES public.job_source_runs(id) ON DELETE SET NULL,
  source_job_id TEXT,
  source_url TEXT NOT NULL,
  raw_payload JSONB,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_url)
);

CREATE TABLE IF NOT EXISTS public.job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_job_id UUID NOT NULL REFERENCES public.normalized_jobs(id) ON DELETE CASCADE,
  search_plan_id UUID REFERENCES public.search_plans(id) ON DELETE SET NULL,
  match_score NUMERIC(5,2) NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  match_explanation JSONB NOT NULL DEFAULT '{}',
  missing_requirements JSONB NOT NULL DEFAULT '[]',
  search_stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'matched',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_job_id)
);

CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  normalized_job_id UUID NOT NULL REFERENCES public.normalized_jobs(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, normalized_job_id)
);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  background_job_id UUID REFERENCES public.background_jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  search_plan JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_run_id, step_key)
);

CREATE TABLE IF NOT EXISTS public.agent_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  diagnostic_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  summary TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  recovery_actions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.application_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'dry_run',
  status TEXT NOT NULL DEFAULT 'preparing',
  field_mapping JSONB NOT NULL DEFAULT '{}',
  unknown_required_answers JSONB NOT NULL DEFAULT '[]',
  consent_state TEXT NOT NULL DEFAULT 'not_requested',
  submitted_to_employer BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Query-pattern indexes, including every ownership column used by RLS.
CREATE INDEX IF NOT EXISTS candidate_experiences_owner_position
  ON public.candidate_experiences (user_id, candidate_profile_id, position);
CREATE INDEX IF NOT EXISTS candidate_projects_owner_position
  ON public.candidate_projects (user_id, candidate_profile_id, position);
CREATE INDEX IF NOT EXISTS candidate_education_owner_position
  ON public.candidate_education (user_id, candidate_profile_id, position);
CREATE INDEX IF NOT EXISTS candidate_skills_owner_category
  ON public.candidate_skills (user_id, candidate_profile_id, category, position);
CREATE INDEX IF NOT EXISTS profile_field_sources_lookup
  ON public.profile_field_sources (user_id, candidate_profile_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS resume_parse_runs_status
  ON public.resume_parse_runs (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_source_runs_status
  ON public.job_source_runs (source_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS normalized_jobs_open_deadline
  ON public.normalized_jobs (job_type, status, application_deadline);
CREATE INDEX IF NOT EXISTS normalized_jobs_search
  ON public.normalized_jobs (lower(title), lower(organization), country);
CREATE INDEX IF NOT EXISTS job_matches_user_score
  ON public.job_matches (user_id, status, match_score DESC);
CREATE INDEX IF NOT EXISTS agent_run_steps_progress
  ON public.agent_run_steps (user_id, agent_run_id, position);
CREATE INDEX IF NOT EXISTS agent_diagnostics_run
  ON public.agent_diagnostics (user_id, agent_run_id, created_at);
CREATE INDEX IF NOT EXISTS application_runs_user_status
  ON public.application_runs (user_id, status, created_at DESC);

-- RLS: deny by default, then grant only owner access. Catalog/source tables
-- are read-only to signed-in users; writes remain service-role only.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'candidate_profiles', 'candidate_contact_details', 'candidate_experiences',
    'candidate_projects', 'candidate_education', 'candidate_skills',
    'candidate_certifications', 'candidate_languages', 'candidate_links',
    'candidate_preferences', 'candidate_job_targets',
    'candidate_location_preferences', 'resume_sources', 'resume_parse_runs',
    'resume_version_sections', 'profile_field_sources',
    'application_answer_bank', 'job_matches', 'saved_jobs', 'agent_runs',
    'agent_run_steps', 'agent_diagnostics', 'application_runs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated ' ||
      'USING (user_id = public.current_app_user_id()) ' ||
      'WITH CHECK (user_id = public.current_app_user_id())',
      table_name || '_owner', table_name
    );
  END LOOP;
END $$;

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_source_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_sources_authenticated_read
  ON public.job_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY job_source_runs_authenticated_read
  ON public.job_source_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY normalized_jobs_authenticated_read
  ON public.normalized_jobs FOR SELECT TO authenticated
  USING (status IN ('open', 'closing_soon', 'unverified'));
CREATE POLICY job_source_records_authenticated_read
  ON public.job_source_records FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.candidate_profiles,
  public.candidate_contact_details,
  public.candidate_experiences,
  public.candidate_projects,
  public.candidate_education,
  public.candidate_skills,
  public.candidate_certifications,
  public.candidate_languages,
  public.candidate_links,
  public.candidate_preferences,
  public.candidate_job_targets,
  public.candidate_location_preferences,
  public.resume_sources,
  public.resume_parse_runs,
  public.resume_version_sections,
  public.profile_field_sources,
  public.application_answer_bank,
  public.job_matches,
  public.saved_jobs,
  public.agent_runs,
  public.agent_run_steps,
  public.agent_diagnostics,
  public.application_runs
TO authenticated;

GRANT SELECT ON
  public.job_sources,
  public.job_source_runs,
  public.normalized_jobs,
  public.job_source_records
TO authenticated;

-- Compatibility backfill. It only populates new rows and never mutates legacy
-- records or later user edits.
INSERT INTO public.candidate_profiles (
  user_id,
  professional_headline,
  professional_summary,
  current_job_role,
  years_of_experience,
  legacy_master_resume_id
)
SELECT
  u.id,
  NULLIF(m.content #>> '{profile,currentRole,value}', ''),
  NULLIF(m.content #>> '{profile,professionalSummary,value}', ''),
  NULLIF(m.content #>> '{profile,currentRole,value}', ''),
  CASE
    WHEN (m.content #>> '{profile,experienceYears,value}') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (m.content #>> '{profile,experienceYears,value}')::numeric
    ELSE NULL
  END,
  m.id
FROM public.users u
LEFT JOIN public.master_resume m ON m.user_id = u.id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.candidate_contact_details (
  user_id, candidate_profile_id, full_name, email, phone, city
)
SELECT
  p.user_id,
  p.id,
  COALESCE(NULLIF(m.content #>> '{profile,fullName,value}', ''), u.full_name),
  COALESCE(NULLIF(m.content #>> '{profile,email,value}', ''), u.email),
  NULLIF(m.content #>> '{profile,phone,value}', ''),
  COALESCE(NULLIF(m.content #>> '{profile,currentLocation,value}', ''), u.current_location)
FROM public.candidate_profiles p
JOIN public.users u ON u.id = p.user_id
LEFT JOIN public.master_resume m ON m.id = p.legacy_master_resume_id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.candidate_skills (
  user_id, candidate_profile_id, name, normalized_name, category, position
)
SELECT
  p.user_id,
  p.id,
  skill.value,
  lower(regexp_replace(trim(skill.value), '\s+', ' ', 'g')),
  'core',
  skill.ordinality - 1
FROM public.candidate_profiles p
JOIN public.master_resume m ON m.id = p.legacy_master_resume_id
CROSS JOIN LATERAL unnest(m.skills) WITH ORDINALITY AS skill(value, ordinality)
WHERE trim(skill.value) <> ''
ON CONFLICT (candidate_profile_id, normalized_name, category) DO NOTHING;

-- Seed honest source capability records. Commercial sources are explicitly
-- unavailable until a permitted integration is configured; public ATS sources
-- reflect the adapters already present in the application.
INSERT INTO public.job_sources (
  key, display_name, source_type, access_method, canonical_url, status,
  enabled, authentication_requirements, limitations, last_verified_at
)
VALUES
  ('linkedin', 'LinkedIn Jobs', 'private', 'user_authorized_or_partner', 'https://www.linkedin.com/jobs/', 'authentication_required', false, 'Permitted user session or partner access required', 'No scraping or CAPTCHA bypass', now()),
  ('naukri', 'Naukri', 'private', 'user_authorized_or_partner', 'https://www.naukri.com/', 'authentication_required', false, 'Permitted user session or partner access required', 'No private endpoint access', now()),
  ('greenhouse', 'Greenhouse public boards', 'ats', 'public_api', 'https://www.greenhouse.com/', 'healthy', true, NULL, 'Only configured public boards are searched', now()),
  ('lever', 'Lever public postings', 'ats', 'public_api', 'https://www.lever.co/', 'healthy', true, NULL, 'Only configured public companies are searched', now()),
  ('ashby', 'Ashby public boards', 'ats', 'public_api', 'https://www.ashbyhq.com/', 'healthy', true, NULL, 'Only configured public boards are searched', now()),
  ('workday', 'Workday public career pages', 'ats', 'public_api', 'https://www.workday.com/', 'healthy', true, NULL, 'Only configured public tenants are searched', now()),
  ('isro', 'ISRO current opportunities', 'government', 'official_public_page', 'https://www.isro.gov.in/Careers.html', 'healthy', true, NULL, 'Only official current-opportunity links are indexed', now()),
  ('ntpc', 'NTPC jobs', 'government', 'official_public_page', 'https://ntpc.co.in/jobs-ntpc', 'healthy', true, NULL, 'Official recruitment notices only', now()),
  ('bel', 'BEL job notifications', 'government', 'official_public_page', 'https://bel-india.in/job-notifications/', 'unavailable', false, NULL, 'Official page currently fails TLS validation; no unsafe bypass is used', now()),
  ('iocl', 'IndianOil latest job openings', 'government', 'official_public_page', 'https://iocl.com/latest-job-opening', 'blocked', false, NULL, 'Official page currently returns an unusable redirect response', now()),
  ('ibps', 'IBPS recruitments', 'government', 'official_public_page', 'https://www.ibps.in/', 'unavailable', false, NULL, 'Official page currently fails TLS validation; no unsafe bypass is used', now()),
  ('railways', 'Railway Recruitment Board Chandigarh', 'government', 'official_public_page', 'https://www.rrbcdg.gov.in/', 'degraded', false, NULL, 'Official page timed out during production verification', now()),
  ('ncs', 'National Career Service', 'government', 'official_source', 'https://www.ncs.gov.in/', 'misconfigured', false, 'Official permitted feed or integration required', 'No production adapter configured yet', now()),
  ('upsc', 'Union Public Service Commission', 'government', 'official_public_page', 'https://www.upsc.gov.in/recruitment/recruitment-advertisement', 'healthy', true, NULL, 'Official recruitment advertisements only', now()),
  ('ssc', 'Staff Selection Commission', 'government', 'official_source', 'https://ssc.gov.in/', 'misconfigured', false, NULL, 'Official notification adapter not yet configured', now())
ON CONFLICT (key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source_type = EXCLUDED.source_type,
  access_method = EXCLUDED.access_method,
  canonical_url = EXCLUDED.canonical_url,
  status = EXCLUDED.status,
  enabled = EXCLUDED.enabled,
  authentication_requirements = EXCLUDED.authentication_requirements,
  limitations = EXCLUDED.limitations,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = now();
