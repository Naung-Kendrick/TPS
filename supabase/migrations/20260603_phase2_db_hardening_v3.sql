-- ============================================================================
-- Migration: Phase 2 DB Hardening v3
--   1. Enforce server-side 12-hour TTL on verified_2fa_sessions in is_2fa_verified()
--   2. Prune expired OTPs & expired 2FA sessions during verify_and_consume_otp()
--   3. Least-privilege table REVOKE/GRANT (strip PUBLIC, anon & TRUNCATE/TRIGGER)
--   4. Harden audit_logs INSERT policy (block NULL user_id / DB_* trigger spoofing)
--   5. Automatic tamper-proof audit triggers on profiles & print_export_requests
-- ============================================================================

-- ── 1. Server-Side 12-hour 2FA Session Expiry ───────────────────────────────
CREATE OR REPLACE FUNCTION public.is_2fa_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt() ->> 'session_id', '') <> ''
    AND EXISTS (
      SELECT 1
      FROM public.verified_2fa_sessions v
      WHERE v.session_id = (auth.jwt() ->> 'session_id')
        AND v.user_id = auth.uid()
        AND v.verified_at > now() - INTERVAL '12 hours'
    );
$$;

-- ── 2. Auto-prune Expired OTPs & Stale 2FA Sessions inside OTP Consumption ──
CREATE OR REPLACE FUNCTION public.verify_and_consume_otp(
  p_user_id    UUID,
  p_code_hash  TEXT,
  p_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Prune expired 2FA sessions and old expired OTP codes (retain 24h window)
  DELETE FROM public.verified_2fa_sessions
  WHERE verified_at < now() - INTERVAL '24 hours';

  DELETE FROM public.otp_codes
  WHERE expires_at < now() - INTERVAL '24 hours'
    AND user_id <> p_user_id;

  RETURN jsonb_build_object('ok', true, 'status', 'verified');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_consume_otp(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_consume_otp(UUID, TEXT, TEXT) TO service_role;

-- ── 3. Least-Privilege SQL Table Grants ─────────────────────────────────────
-- Service-only secret/session tables: zero direct privileges for anon/authenticated
REVOKE ALL ON TABLE public.otp_codes, public.verified_2fa_sessions, public.tps_access_token
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.otp_codes, public.verified_2fa_sessions, public.tps_access_token
  TO service_role;

-- Client-accessible RLS tables: revoke all from PUBLIC/anon & dangerous DDL/truncate grants
REVOKE ALL ON TABLE public.households, public.profiles, public.audit_logs, public.print_export_requests
  FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.households, public.profiles, public.audit_logs, public.print_export_requests
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.households TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.print_export_requests TO authenticated;

GRANT ALL ON TABLE public.households, public.profiles, public.audit_logs, public.print_export_requests
  TO service_role;

-- ── 4. Tighten audit_logs INSERT Policy (prevent NULL user_id & DB_* spoofing) ─
DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_2fa_verified()
    AND user_id = auth.uid()
    AND action NOT LIKE 'DB\_%' ESCAPE '\'
  );

-- ── 5. Tamper-Proof DB Audit Triggers for profiles & print_export_requests ────
CREATE OR REPLACE FUNCTION public.log_profile_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_PROFILE_INSERT',
      'profiles',
      jsonb_build_object(
        'target_user_id', NEW.id,
        'username', NEW.username,
        'role', NEW.role,
        'access_level', NEW.access_level,
        'is_active', NEW.is_active,
        'allowed_districts', NEW.allowed_districts,
        'allowed_townships', NEW.allowed_townships,
        'timestamp', now()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip noisy 2-minute last_seen_at heartbeat updates; audit only security/scope/identity changes
    IF (OLD.role IS DISTINCT FROM NEW.role)
       OR (OLD.access_level IS DISTINCT FROM NEW.access_level)
       OR (OLD.is_active IS DISTINCT FROM NEW.is_active)
       OR (OLD.allowed_districts IS DISTINCT FROM NEW.allowed_districts)
       OR (OLD.allowed_townships IS DISTINCT FROM NEW.allowed_townships)
       OR (OLD.username IS DISTINCT FROM NEW.username)
       OR (OLD.email IS DISTINCT FROM NEW.email)
    THEN
      INSERT INTO public.audit_logs (user_id, action, table_name, details)
      VALUES (
        auth.uid(),
        'DB_PROFILE_UPDATE',
        'profiles',
        jsonb_build_object(
          'target_user_id', NEW.id,
          'username', NEW.username,
          'old_role', OLD.role,
          'new_role', NEW.role,
          'old_access_level', OLD.access_level,
          'new_access_level', NEW.access_level,
          'old_is_active', OLD.is_active,
          'new_is_active', NEW.is_active,
          'old_allowed_districts', OLD.allowed_districts,
          'new_allowed_districts', NEW.allowed_districts,
          'old_allowed_townships', OLD.allowed_townships,
          'new_allowed_townships', NEW.allowed_townships,
          'timestamp', now()
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_PROFILE_DELETE',
      'profiles',
      jsonb_build_object(
        'target_user_id', OLD.id,
        'username', OLD.username,
        'role', OLD.role,
        'access_level', OLD.access_level,
        'timestamp', now()
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_profile_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_profiles_mutation ON public.profiles;
CREATE TRIGGER trg_audit_profiles_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_mutation();

CREATE OR REPLACE FUNCTION public.log_print_export_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_EXPORT_REQUEST_CREATE',
      'print_export_requests',
      jsonb_build_object(
        'request_id', NEW.id,
        'requester_id', NEW.requester_id,
        'page', NEW.page,
        'export_type', NEW.export_type,
        'status', NEW.status,
        'filters', NEW.filters,
        'timestamp', now()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_EXPORT_REQUEST_UPDATE',
      'print_export_requests',
      jsonb_build_object(
        'request_id', NEW.id,
        'requester_id', NEW.requester_id,
        'page', NEW.page,
        'export_type', NEW.export_type,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'resolved_by', NEW.resolved_by,
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_print_export_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_print_export_mutation ON public.print_export_requests;
CREATE TRIGGER trg_audit_print_export_mutation
  AFTER INSERT OR UPDATE ON public.print_export_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.log_print_export_mutation();
