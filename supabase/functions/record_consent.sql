-- Function: record_consent
-- SECURITY DEFINER function that inserts a row into the consents table.
-- Called via Supabase RPC with the service role — no direct client INSERT path exists.
--
-- Parameters:
--   p_user_id    uuid   — the authenticated user's ID
--   p_version    text   — the privacy notice version string, e.g. "v1.0"
--   p_age_bracket text  — 'minor' | 'adult'

CREATE OR REPLACE FUNCTION record_consent(
  p_user_id     uuid,
  p_version     text,
  p_age_bracket text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate age_bracket to prevent injection of arbitrary values
  IF p_age_bracket NOT IN ('minor', 'adult') THEN
    RAISE EXCEPTION 'Invalid age_bracket: %', p_age_bracket;
  END IF;

  INSERT INTO consents (user_id, privacy_notice_version, age_bracket)
  VALUES (p_user_id, p_version, p_age_bracket);
END;
$$;

-- Revoke direct execute from public / anon; only the service role may call this.
REVOKE EXECUTE ON FUNCTION record_consent(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION record_consent(uuid, text, text) TO service_role;
