-- Forward-only correction based on live server-adapter verification.
-- Do not claim source health when the public page does not expose usable data.
UPDATE public.job_sources
SET
  status = 'degraded',
  enabled = false,
  limitations = 'Official page returns a client shell without server-readable notices',
  last_verified_at = now(),
  updated_at = now()
WHERE key = 'ssc';

UPDATE public.job_sources
SET
  status = 'blocked',
  enabled = false,
  limitations = 'Official page presents a CAPTCHA challenge; no bypass is used',
  last_verified_at = now(),
  updated_at = now()
WHERE key = 'rbi';
