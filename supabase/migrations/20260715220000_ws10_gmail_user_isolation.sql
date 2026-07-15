ALTER TABLE public.emails
  DROP CONSTRAINT IF EXISTS emails_gmail_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS emails_user_id_gmail_id_key
  ON public.emails(user_id, gmail_id);
