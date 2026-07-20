-- Forward-only source expansion for domain-restricted public discovery.
-- These values describe the canonical publisher; discovery still requires an
-- approved server-side search provider and stores only public index metadata.
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'FOUNDIT';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'SHINE';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'TIMESJOBS';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'CUTSHORT';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'INSTAHYRE';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'INTERNSHALA';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'APNA';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'FRESHERSWORLD';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'HIRIST';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'IIMJOBS';

INSERT INTO public.job_sources (
  key, display_name, source_type, access_method, canonical_url, status,
  enabled, authentication_requirements, limitations, last_verified_at
)
VALUES
  ('foundit', 'Foundit India', 'public_discovery', 'domain_restricted_search', 'https://www.foundit.in/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('shine', 'Shine', 'public_discovery', 'domain_restricted_search', 'https://www.shine.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('timesjobs', 'TimesJobs', 'public_discovery', 'domain_restricted_search', 'https://www.timesjobs.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('cutshort', 'Cutshort', 'public_discovery', 'domain_restricted_search', 'https://cutshort.io/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('instahyre', 'Instahyre', 'public_discovery', 'domain_restricted_search', 'https://www.instahyre.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('internshala', 'Internshala', 'public_discovery', 'domain_restricted_search', 'https://internshala.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('apna', 'Apna', 'public_discovery', 'domain_restricted_search', 'https://apna.co/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('freshersworld', 'Freshersworld', 'public_discovery', 'domain_restricted_search', 'https://www.freshersworld.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('hirist', 'Hirist', 'public_discovery', 'domain_restricted_search', 'https://www.hirist.tech/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now()),
  ('iimjobs', 'iimjobs', 'public_discovery', 'domain_restricted_search', 'https://www.iimjobs.com/', 'setup_required', false, NULL, 'Requires an approved server-side search provider; public snippets and individual canonical job URLs only', now())
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
