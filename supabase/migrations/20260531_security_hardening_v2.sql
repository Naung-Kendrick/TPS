-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Step 6 (Security Hardening v2) — Atomic OTP & Defense-in-Depth
-- Depends on: 20260529_verified_2fa_sessions.sql,
--             20260530_security_rls_and_rpcs_hardening.sql
--
-- Fixes & Hardening:
--   1. Atomic OTP verification + attempt increment under FOR UPDATE row lock
--      (prevents parallel brute-force race conditions on verify-otp).
--   2. Strict deny-all RLS on public.otp_codes for BOTH anon & authenticated.
--   3. Prevent regional+viewer from approving print_export_requests.
--   4. Require 2FA verification & active status for profiles self-update.
--   5. Tighten print_export_requests INSERT validation (non-sub_township,
--      active user, pending status, null resolution fields).
--   6. Harden verify_access_token with 2FA requirement & FOR UPDATE row lock.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Atomic OTP Verification & Consumption (service_role ONLY) ────────────
CREATE OR REPLACE FUNCTION public.verify_and_consume_otp(
  p_user_id    UUID,
  p_code_hash  TEXT,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec      public.otp_codes%ROWTYPE;
  diff     INT := 0;
  i        INT;
  len_a    INT;
  len_b    INT;
BEGIN
  IF p_user_id IS NULL OR COALESCE(p_code_hash, '') = '' OR COALESCE(p_session_id, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'invalid_input');
  END IF;

  -- Row lock prevents concurrent brute-force requests from racing attempts
  SELECT * INTO rec
  FROM public.otp_codes
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'no_otp');
  END IF;

  IF rec.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired');
  END IF;

  IF rec.used THEN
    RETURN jsonb_build_object('ok', false, 'status', 'used');
  END IF;

  IF COALESCE(rec.attempts, 0) >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'status', 'locked', 'remaining_attempts', 0);
  END IF;

  -- Consume 1 attempt atomically BEFORE comparing hash
  UPDATE public.otp_codes
  SET attempts = COALESCE(rec.attempts, 0) + 1
  WHERE user_id = p_user_id;

  -- Constant-time string comparison
  len_a := char_length(rec.code);
  len_b := char_length(p_code_hash);
  IF len_a <> len_b THEN
    diff := 1;
  ELSE
    FOR i IN 1..len_a LOOP
      diff := diff | (ascii(substr(rec.code, i, 1)) # ascii(substr(p_code_hash, i, 1)));
    END LOOP;
  END IF;

  IF diff <> 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'status', 'mismatch',
      'remaining_attempts', GREATEST(0, 5 - (COALESCE(rec.attempts, 0) + 1))
    );
  END IF;

  -- Mark OTP used and record server-verified 2FA session in one atomic transaction
  UPDATE public.otp_codes
  SET used = TRUE
  WHERE user_id = p_user_id;

  INSERT INTO public.verified_2fa_sessions (session_id, user_id, verified_at)
  VALUES (p_session_id, p_user_id, now())
  ON CONFLICT (session_id) DO UPDATE SET
    user_id     = EXCLUDED.user_id,
    verified_at = EXCLUDED.verified_at;

  RETURN jsonb_build_object('ok', true, 'status', 'verified');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_consume_otp(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_consume_otp(UUID, TEXT, TEXT) TO service_role;


-- ── 2. Strict Deny-All on public.otp_codes (anon & authenticated) ───────────
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS otp_codes_deny_all ON public.otp_codes;
CREATE POLICY otp_codes_deny_all
  ON public.otp_codes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);


-- ── 3. Prevent regional+viewer from Admin/Regional Approval Privileges ──────
CREATE OR REPLACE FUNCTION public.is_active_admin_or_regional()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_2fa_verified()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('system', 'master', 'admin', 'regional')
        AND p.access_level NOT IN ('viewer', 'sub_township')
    );
$$;


-- ── 4. Require 2FA & Active Account on Self Profile Updates (last_seen_at) ──
DROP POLICY IF EXISTS profiles_update_own_safe ON public.profiles;
CREATE POLICY profiles_update_own_safe
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    AND public.is_2fa_verified()
    AND is_active IS NOT FALSE
  )
  WITH CHECK (
    auth.uid() = id
    AND public.is_2fa_verified()
    AND is_active IS NOT FALSE
    AND public.self_profile_unchanged(
      id, role, access_level, is_active, allowed_districts, allowed_townships, username, email
    )
  );


-- ── 5. Tighten print_export_requests INSERT Integrity ───────────────────────
DROP POLICY IF EXISTS per_insert_own_pending ON public.print_export_requests;
CREATE POLICY per_insert_own_pending
  ON public.print_export_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_2fa_verified()
    AND requester_id = auth.uid()
    AND status = 'pending'
    AND resolved_by IS NULL
    AND resolved_at IS NULL
    AND page IN ('statistics', 'demographics')
    AND export_type IN ('print', 'excel')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.access_level <> 'sub_township'
    )
  );


-- ── 6. Harden verify_access_token (require 2FA, active user & FOR UPDATE) ───
CREATE OR REPLACE FUNCTION public.verify_access_token(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec     public.tps_access_token%ROWTYPE;
  matched BOOLEAN;
BEGIN
  IF NOT public.is_2fa_verified() THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_active IS NOT FALSE
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO rec
  FROM public.tps_access_token
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND OR rec.locked OR rec.expires_at < now() THEN
    RETURN FALSE;
  END IF;

  matched := (crypt(COALESCE(candidate, ''), rec.token_hash) = rec.token_hash);

  IF matched THEN
    UPDATE public.tps_access_token SET fail_count = 0 WHERE id = 1;
    RETURN TRUE;
  ELSE
    UPDATE public.tps_access_token
    SET
      fail_count = rec.fail_count + 1,
      locked     = (rec.fail_count + 1 >= 10)
    WHERE id = 1;
    RETURN FALSE;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_access_token(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_token(TEXT) TO authenticated;
