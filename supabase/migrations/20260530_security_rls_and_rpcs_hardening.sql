-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Step 3 — Postgres RLS Policies, Geographic Scoping & RPC Hardening
-- Depends on: 20260529_verified_2fa_sessions.sql (public.is_2fa_verified())
--
-- What this migration secures:
--   1. Helper functions with fixed search_path (get_my_role, self_profile_unchanged,
--      can_access_household).
--   2. public.profiles RLS: prevents privilege escalation (users cannot edit their
--      own role/access_level/is_active/districts/townships) and restricts listing
--      all officers' emails/profiles to active System/Master admins only.
--   3. public.print_export_requests RLS: prevents viewers from self-approving
--      requests; restricts reading requests to requester or admins.
--   4. public.households RLS: enforces mandatory 2FA, active account status,
--      view-only restrictions (viewer/sub_township cannot write), and strict
--      district/township scoping on SELECT/INSERT/UPDATE/DELETE.
--   5. public.audit_logs RLS + trigger: tamper-proof append-only audit logs with
--      automatic server-side logging for households UPDATE/DELETE.
--   6. RPC hardening: revokes anon execute permissions on stats_*/report_* RPCs
--      and verify_access_token; tightens set_access_token/get_access_token_status.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Security Helper Functions ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Checks whether caller is 2FA-verified, active, and System/Master admin
CREATE OR REPLACE FUNCTION public.is_active_system_admin()
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
        AND p.role IN ('system', 'master')
    );
$$;

-- Checks whether caller is 2FA-verified, active, and any Admin/Regional role
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
    );
$$;

-- Verifies that a non-admin self-update on profiles does NOT alter privileged columns
CREATE OR REPLACE FUNCTION public.self_profile_unchanged(
  p_id         UUID,
  p_role       TEXT,
  p_level      TEXT,
  p_active     BOOLEAN,
  p_districts  TEXT[],
  p_townships  TEXT[],
  p_username   TEXT,
  p_email      TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_id
      AND p.role IS NOT DISTINCT FROM p_role
      AND p.access_level IS NOT DISTINCT FROM p_level
      AND p.is_active IS NOT DISTINCT FROM p_active
      AND p.allowed_districts IS NOT DISTINCT FROM p_districts
      AND p.allowed_townships IS NOT DISTINCT FROM p_townships
      AND p.username IS NOT DISTINCT FROM p_username
      AND p.email IS NOT DISTINCT FROM p_email
  );
$$;

-- Checks whether the current user is 2FA-verified, active, and permitted to access
-- a household row matching (row_district, row_township).
CREATE OR REPLACE FUNCTION public.can_access_household(
  row_district TEXT,
  row_township TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof RECORD;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_2fa_verified() THEN
    RETURN FALSE;
  END IF;

  SELECT role, access_level, is_active, allowed_districts, allowed_townships
  INTO prof
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT FOUND OR prof.is_active IS FALSE THEN
    RETURN FALSE;
  END IF;

  IF prof.role NOT IN ('system', 'master', 'regional', 'admin', 'ops', 'field') THEN
    RETURN FALSE;
  END IF;

  IF prof.access_level = 'central' THEN
    RETURN TRUE;
  ELSIF prof.access_level IN ('district', 'viewer') THEN
    RETURN COALESCE(row_district, '') <> ''
       AND row_district = ANY(COALESCE(prof.allowed_districts, '{}'::TEXT[]));
  ELSIF prof.access_level IN ('township', 'sub_township') THEN
    RETURN COALESCE(row_township, '') <> ''
       AND row_township = ANY(COALESCE(prof.allowed_townships, '{}'::TEXT[]));
  END IF;

  RETURN FALSE;
END;
$$;

-- Checks whether the current user is allowed to write (INSERT/UPDATE/DELETE) households
CREATE OR REPLACE FUNCTION public.can_write_household(
  row_district TEXT,
  row_township TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof RECORD;
BEGIN
  IF NOT public.can_access_household(row_district, row_township) THEN
    RETURN FALSE;
  END IF;

  SELECT role, access_level
  INTO prof
  FROM public.profiles
  WHERE id = auth.uid();

  IF prof.access_level IN ('viewer', 'sub_township') THEN
    RETURN FALSE;
  END IF;

  RETURN prof.role IN ('system', 'master', 'regional', 'admin', 'ops', 'field');
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_system_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_admin_or_regional() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.self_profile_unchanged(UUID, TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_household(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_write_household(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_system_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin_or_regional() TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_profile_unchanged(UUID, TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_household(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_household(TEXT, TEXT) TO authenticated;


-- ── 2. public.profiles RLS Hardening ────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END$$;

-- Users can read their own profile (needed during Step 1 login check);
-- 2FA-verified System/Master admins can read all profiles (for UserManagement).
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_active_system_admin()
  );

-- Users can update ONLY safe non-privileged fields (e.g. last_seen_at) on their own row.
-- Note: allowed during Step 2 completion (last_seen_at stamp) and heartbeat.
CREATE POLICY profiles_update_own_safe
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND public.self_profile_unchanged(
      id, role, access_level, is_active, allowed_districts, allowed_townships, username, email
    )
  );

-- Only 2FA-verified active System/Master admins can update other users' role/access/status.
CREATE POLICY profiles_admin_update_all
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_active_system_admin())
  WITH CHECK (public.is_active_system_admin());


-- ── 3. public.print_export_requests RLS Hardening ───────────────────────────

ALTER TABLE public.print_export_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'print_export_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.print_export_requests', pol.policyname);
  END LOOP;
END$$;

-- Authenticated & 2FA-verified users can submit pending requests for themselves only
CREATE POLICY per_insert_own_pending
  ON public.print_export_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_2fa_verified()
    AND requester_id = auth.uid()
    AND status = 'pending'
  );

-- Requesters see their own requests; active Admins/Regional admins see all requests
CREATE POLICY per_select_own_or_admin
  ON public.print_export_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_2fa_verified()
    AND (
      requester_id = auth.uid()
      OR public.is_active_admin_or_regional()
    )
  );

-- Only active Admins/Regional admins can resolve (approve) pending requests
CREATE POLICY per_update_admin_resolve
  ON public.print_export_requests
  FOR UPDATE
  TO authenticated
  USING (public.is_active_admin_or_regional())
  WITH CHECK (public.is_active_admin_or_regional());

-- Requesters can ONLY transition their own already-resolved request to 'used'
CREATE POLICY per_update_requester_mark_used
  ON public.print_export_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_2fa_verified()
    AND requester_id = auth.uid()
    AND status = 'resolved'
  )
  WITH CHECK (
    public.is_2fa_verified()
    AND requester_id = auth.uid()
    AND status = 'used'
  );


-- ── 4. public.households RLS Hardening (2FA + Role + District/Township) ─────

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'households'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.households', pol.policyname);
  END LOOP;
END$$;

CREATE POLICY households_select_scoped
  ON public.households
  FOR SELECT
  TO authenticated
  USING (public.can_access_household(district, township));

CREATE POLICY households_insert_scoped
  ON public.households
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_household(district, township));

CREATE POLICY households_update_scoped
  ON public.households
  FOR UPDATE
  TO authenticated
  USING (public.can_write_household(district, township))
  WITH CHECK (public.can_write_household(district, township));

CREATE POLICY households_delete_scoped
  ON public.households
  FOR DELETE
  TO authenticated
  USING (public.can_write_household(district, township));


-- ── 5. public.audit_logs RLS + Automatic Tamper-Proof Mutation Trigger ──────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  table_name TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_logs', pol.policyname);
  END LOOP;
END$$;

-- Append-only for 2FA-verified users (cannot spoof another user_id); no UPDATE/DELETE policies
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_2fa_verified()
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Only 2FA-verified active System/Master admins can read audit logs
CREATE POLICY audit_logs_select_admin
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_active_system_admin());

-- Server-side trigger so every UPDATE/DELETE on households is logged even if client skips UI modal
CREATE OR REPLACE FUNCTION public.log_household_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_UPDATE_MEMBER',
      'households',
      jsonb_build_object(
        'record_id', NEW.id,
        'household_no', NEW.household_no,
        'member_name', NEW.name,
        'old_district', OLD.district,
        'new_district', NEW.district,
        'old_township', OLD.township,
        'new_township', NEW.township,
        'timestamp', now()
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, details)
    VALUES (
      auth.uid(),
      'DB_DELETE_MEMBER',
      'households',
      jsonb_build_object(
        'record_id', OLD.id,
        'household_no', OLD.household_no,
        'member_name', OLD.name,
        'district', OLD.district,
        'township', OLD.township,
        'timestamp', now()
      )
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_households_mutation ON public.households;
CREATE TRIGGER trg_audit_households_mutation
  AFTER UPDATE OR DELETE ON public.households
  FOR EACH ROW
  EXECUTE FUNCTION public.log_household_mutation();


-- ── 6. RPC Permissions & Access Token Hardening ─────────────────────────────

-- Revoke anon execute on all statistics/report RPCs (must be authenticated + 2FA via RLS)
REVOKE EXECUTE ON FUNCTION public.stats_districts() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stats_townships(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stats_locations(text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stats_breakdown(text, text, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_districts() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_townships(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_villages(text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.stats_districts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_townships(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_locations(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stats_breakdown(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_districts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_townships(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_villages(text) TO authenticated;

-- Also lock down optional report_* RPCs if present in live DB
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'report_wards') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.report_wards(text) FROM anon, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.report_wards(text) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'report_groups_by_township') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.report_groups_by_township(text) FROM anon, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.report_groups_by_township(text) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'report_village_only') THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.report_village_only(text) FROM anon, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.report_village_only(text) TO authenticated';
  END IF;
END$$;

-- Tighten set_access_token & get_access_token_status (system/master + 2FA verified only; remove 'admin')
CREATE OR REPLACE FUNCTION public.set_access_token(new_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF NOT public.is_2fa_verified() THEN
    RAISE EXCEPTION 'Unauthorized: 2FA verification required';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active IS NOT FALSE;

  IF caller_role NOT IN ('system', 'master') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient role';
  END IF;

  IF new_code !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Access token must be exactly 6 digits';
  END IF;

  INSERT INTO public.tps_access_token (id, token_hash, expires_at, fail_count, locked, created_at)
  VALUES (
    1,
    crypt(new_code, gen_salt('bf', 12)),
    now() + INTERVAL '7 days',
    0,
    FALSE,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    token_hash = EXCLUDED.token_hash,
    expires_at = EXCLUDED.expires_at,
    fail_count = 0,
    locked     = FALSE,
    created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_access_token_status()
RETURNS TABLE(expires_at TIMESTAMPTZ, fail_count INT, locked BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  IF NOT public.is_2fa_verified() THEN
    RAISE EXCEPTION 'Unauthorized: 2FA verification required';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active IS NOT FALSE;

  IF caller_role NOT IN ('system', 'master') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient role';
  END IF;

  RETURN QUERY
  SELECT t.expires_at, t.fail_count, t.locked, t.created_at
  FROM public.tps_access_token t
  WHERE t.id = 1;
END;
$$;

-- Prevent unauthenticated DoS lockouts on tps_access_token
REVOKE EXECUTE ON FUNCTION public.verify_access_token(TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_access_token(TEXT) TO authenticated;

-- Pin search_path on existing stats/report functions (resolves Security Advisor warnings)
DO $$
DECLARE
  fn_sig TEXT;
  sigs TEXT[] := ARRAY[
    'public.parse_myanmar_date(text)',
    'public.classify_wvg(text)',
    'public.split_wvg(text)',
    'public.age_bucket(text)',
    'public.age_bucket_6(text)',
    'public.stats_districts()',
    'public.stats_townships(text)',
    'public.stats_locations(text, text)',
    'public.stats_breakdown(text, text, text, text, text)',
    'public.report_districts()',
    'public.report_townships(text)',
    'public.report_villages(text)',
    'public.report_wards(text)',
    'public.report_groups_by_township(text)',
    'public.report_village_only(text)'
  ];
BEGIN
  FOREACH fn_sig IN ARRAY sigs LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn_sig);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END LOOP;
END$$;
