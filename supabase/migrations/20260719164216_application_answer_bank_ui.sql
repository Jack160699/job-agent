ALTER TABLE public.application_answer_bank
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1
    CHECK (version >= 1);

CREATE TABLE IF NOT EXISTS public.application_answer_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer_bank_id UUID REFERENCES public.application_answer_bank(id)
    ON DELETE SET NULL,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  answer JSONB NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT true,
  confirmation_state TEXT NOT NULL DEFAULT 'unconfirmed',
  version INTEGER NOT NULL CHECK (version >= 1),
  change_reason TEXT NOT NULL DEFAULT 'updated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.application_answer_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer_bank_id UUID NOT NULL REFERENCES public.application_answer_bank(id)
    ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  answer_snapshot JSONB NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_answer_versions_owner_history
  ON public.application_answer_versions
  (user_id, answer_bank_id, version DESC);
CREATE INDEX IF NOT EXISTS application_answer_usage_owner_recent
  ON public.application_answer_usage
  (user_id, answer_bank_id, used_at DESC);
CREATE INDEX IF NOT EXISTS application_answer_usage_application
  ON public.application_answer_usage
  (user_id, application_id);

ALTER TABLE public.application_answer_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_answer_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_answer_versions_owner
  ON public.application_answer_versions FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY application_answer_usage_owner
  ON public.application_answer_usage FOR ALL TO authenticated
  USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.application_answer_versions,
  public.application_answer_usage
TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_application_answer_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.application_answer_versions (
      user_id, answer_bank_id, question_key, question_label, answer,
      is_sensitive, is_private, confirmation_state, version, change_reason
    )
    VALUES (
      OLD.user_id, NULL, OLD.question_key, OLD.question_label, OLD.answer,
      OLD.is_sensitive, OLD.is_private, OLD.confirmation_state, OLD.version,
      'deleted'
    );
    RETURN OLD;
  END IF;

  IF (
    OLD.question_label,
    OLD.answer,
    OLD.is_sensitive,
    OLD.is_private,
    OLD.confirmation_state
  ) IS DISTINCT FROM (
    NEW.question_label,
    NEW.answer,
    NEW.is_sensitive,
    NEW.is_private,
    NEW.confirmation_state
  ) THEN
    INSERT INTO public.application_answer_versions (
      user_id, answer_bank_id, question_key, question_label, answer,
      is_sensitive, is_private, confirmation_state, version, change_reason
    )
    VALUES (
      OLD.user_id, OLD.id, OLD.question_key, OLD.question_label, OLD.answer,
      OLD.is_sensitive, OLD.is_private, OLD.confirmation_state, OLD.version,
      CASE
        WHEN OLD.confirmation_state IS DISTINCT FROM NEW.confirmation_state
          THEN 'confirmation_changed'
        ELSE 'updated'
      END
    );
    NEW.version := OLD.version + 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_answer_bank_capture_version
  ON public.application_answer_bank;
CREATE TRIGGER application_answer_bank_capture_version
BEFORE UPDATE OR DELETE ON public.application_answer_bank
FOR EACH ROW EXECUTE FUNCTION public.capture_application_answer_version();
