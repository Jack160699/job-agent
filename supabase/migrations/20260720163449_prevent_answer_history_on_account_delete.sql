-- Keep direct answer deletion history, but do not create a new child row while
-- application answers are being cascade-deleted with their owning user.
CREATE OR REPLACE FUNCTION public.capture_application_answer_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() = 1
      AND EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = OLD.user_id
      )
    THEN
      INSERT INTO public.application_answer_versions (
        user_id, answer_bank_id, question_key, question_label, answer,
        is_sensitive, is_private, confirmation_state, version, change_reason
      )
      VALUES (
        OLD.user_id, NULL, OLD.question_key, OLD.question_label, OLD.answer,
        OLD.is_sensitive, OLD.is_private, OLD.confirmation_state, OLD.version,
        'deleted'
      );
    END IF;

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
