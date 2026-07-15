CREATE TABLE IF NOT EXISTS public.oauth_state_nonces (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_state_nonces_expires_at_idx
  ON public.oauth_state_nonces(expires_at);
CREATE INDEX IF NOT EXISTS oauth_state_nonces_user_id_consumed_at_idx
  ON public.oauth_state_nonces(user_id, consumed_at);

ALTER TABLE public.oauth_state_nonces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oauth_state_nonces FROM anon, authenticated;
