-- Durable rate-limit buckets for serverless production instances
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_ms integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window_start
  ON public.rate_limit_buckets (window_start);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Service role / Prisma only — no client access
CREATE POLICY rate_limit_buckets_service_only ON public.rate_limit_buckets
  FOR ALL
  USING (false)
  WITH CHECK (false);
