-- Add only official sources verified reachable over ordinary TLS on 2026-07-19.
-- The adapters still reject stale, expired, and status-only notices.
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'SSC';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'DRDO';
ALTER TYPE public.job_source ADD VALUE IF NOT EXISTS 'RBI';

INSERT INTO public.job_sources (
  key, display_name, source_type, access_method, canonical_url, status,
  enabled, authentication_requirements, limitations, last_verified_at
)
VALUES
  ('ssc', 'Staff Selection Commission', 'government', 'official_public_page', 'https://ssc.gov.in/', 'healthy', true, NULL, 'Recent official recruitment notices only; status notices are excluded', now()),
  ('drdo', 'DRDO vacancies', 'government', 'official_public_page', 'https://www.drdo.gov.in/drdo/offerings/vacancies?page=0', 'healthy', true, NULL, 'Recent official vacancy notices only', now()),
  ('rbi', 'Reserve Bank of India vacancies', 'government', 'official_public_page', 'https://opportunities.rbi.org.in/Scripts/Vacancies.aspx', 'healthy', true, NULL, 'Recent official vacancy notices only; expired notices are excluded', now())
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
