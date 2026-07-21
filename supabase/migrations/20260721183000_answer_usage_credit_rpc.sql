-- Idempotent answer-bank usage credit keyed by (application_id, answer_bank_id).
-- Deduplicate any legacy rows before enforcing uniqueness.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY application_id, answer_bank_id
      ORDER BY used_at ASC, id ASC
    ) AS rn
  FROM public.application_answer_usage
  WHERE application_id IS NOT NULL
)
DELETE FROM public.application_answer_usage usage
USING ranked
WHERE usage.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS application_answer_usage_app_answer_unique
  ON public.application_answer_usage (application_id, answer_bank_id)
  WHERE application_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_application_answer_usage(
  p_user_id UUID,
  p_application_id UUID,
  p_answer_bank_id UUID,
  p_field_key TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'preparation'
)
RETURNS TABLE (
  inserted BOOLEAN,
  already_recorded BOOLEAN,
  current_usage_count INTEGER,
  usage_record_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_answer public.application_answer_bank%ROWTYPE;
  v_application_owner UUID;
  v_usage_id UUID;
  v_inserted BOOLEAN := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_DELETED';
  END IF;

  SELECT *
  INTO v_answer
  FROM public.application_answer_bank
  WHERE id = p_answer_bank_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ANSWER_NOT_OWNED_OR_MISSING';
  END IF;

  IF p_field_key IS NOT NULL AND v_answer.question_key IS DISTINCT FROM p_field_key THEN
    RAISE EXCEPTION 'ANSWER_FIELD_MISMATCH';
  END IF;

  IF v_answer.confirmation_state IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION 'ANSWER_NOT_CONFIRMED';
  END IF;

  SELECT user_id
  INTO v_application_owner
  FROM public.applications
  WHERE id = p_application_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPLICATION_NOT_FOUND';
  END IF;

  IF v_application_owner IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'APPLICATION_NOT_OWNED';
  END IF;

  INSERT INTO public.application_answer_usage (
    user_id,
    answer_bank_id,
    application_id,
    answer_snapshot
  )
  VALUES (
    p_user_id,
    p_answer_bank_id,
    p_application_id,
    v_answer.answer
  )
  ON CONFLICT (application_id, answer_bank_id)
    WHERE (application_id IS NOT NULL)
  DO NOTHING
  RETURNING id INTO v_usage_id;

  IF v_usage_id IS NOT NULL THEN
    v_inserted := true;
    UPDATE public.application_answer_bank
    SET
      usage_count = usage_count + 1,
      last_used_at = now(),
      updated_at = now()
    WHERE id = p_answer_bank_id;
  ELSE
    SELECT id
    INTO v_usage_id
    FROM public.application_answer_usage
    WHERE application_id = p_application_id
      AND answer_bank_id = p_answer_bank_id
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT
    v_inserted,
    NOT v_inserted,
    (
      SELECT usage_count
      FROM public.application_answer_bank
      WHERE id = p_answer_bank_id
    ),
    v_usage_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_application_answer_usage(
  p_user_id UUID,
  p_application_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_removed INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.applications
    WHERE id = p_application_id
      AND user_id = p_user_id
  ) THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, answer_bank_id
    FROM public.application_answer_usage
    WHERE user_id = p_user_id
      AND application_id = p_application_id
  LOOP
    DELETE FROM public.application_answer_usage WHERE id = v_row.id;
    UPDATE public.application_answer_bank
    SET
      usage_count = GREATEST(usage_count - 1, 0),
      updated_at = now()
    WHERE id = v_row.answer_bank_id
      AND user_id = p_user_id;
    v_removed := v_removed + 1;
  END LOOP;

  RETURN v_removed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_application_answer_usage(UUID, UUID, UUID, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_application_answer_usage(UUID, UUID)
  TO authenticated, service_role;
