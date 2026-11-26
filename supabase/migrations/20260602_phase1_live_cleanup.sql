-- ============================================================================
-- Migration: Phase 1 Live Security Cleanup
--   1. Tighten storage.objects (id-scans) RLS policies to enforce 2FA & scope
--   2. Drop unused legacy SECURITY DEFINER role/admin functions
--   3. Pin search_path = public on remaining functions
--   4. Revoke PUBLIC and anon EXECUTE grants from security-sensitive functions
-- ============================================================================

-- ── 1. Storage bucket RLS hardening (only when storage schema is present) ────
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS active_users_read_id_scans ON storage.objects;
    DROP POLICY IF EXISTS active_users_upload_id_scans ON storage.objects;
    DROP POLICY IF EXISTS active_users_delete_id_scans ON storage.objects;

    CREATE POLICY active_users_read_id_scans
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'id-scans'
        AND public.is_2fa_verified()
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active IS NOT FALSE
        )
      );

    CREATE POLICY active_users_upload_id_scans
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'id-scans'
        AND public.is_2fa_verified()
        AND EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active IS NOT FALSE
            AND p.access_level NOT IN ('viewer', 'sub_township')
            AND p.role IN ('system', 'master', 'regional', 'admin', 'ops', 'field')
        )
      );

    CREATE POLICY active_users_delete_id_scans
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'id-scans'
        AND public.is_active_admin_or_regional()
      );
  END IF;
END $$;

-- ── 2. Drop unused legacy SECURITY DEFINER helpers ───────────────────────────
DROP FUNCTION IF EXISTS public.check_is_admin(uuid);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.is_ops_or_higher();

-- Harden is_user_active() with fixed search_path + mandatory 2FA check
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.is_2fa_verified()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND is_active IS NOT FALSE
    );
$$;

-- ── 3. Pin search_path on remaining helper/trigger functions ─────────────────
DO $$
DECLARE
  sig TEXT;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.report_groups(text)',
    'public.normalize_myanmar_text(text)',
    'public.update_updated_at_column()'
  ] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path TO ''public''', sig);
    END IF;
  END LOOP;
END $$;

-- ── 4. Revoke PUBLIC and anon EXECUTE on security-sensitive RPCs & helpers ───
DO $$
DECLARE
  sig TEXT;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.is_2fa_verified()',
    'public.is_user_active()',
    'public.is_active_system_admin()',
    'public.is_active_admin_or_regional()',
    'public.can_access_household(text, text)',
    'public.can_write_household(text, text)',
    'public.get_my_role()',
    'public.get_access_token_status()',
    'public.set_access_token(text)',
    'public.verify_access_token(text)',
    'public.revoke_current_2fa_session()',
    'public.self_profile_unchanged(uuid, text, text, boolean, text[], text[], text, text)'
  ] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    END IF;
  END LOOP;

  IF to_regprocedure('public.log_household_mutation()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.log_household_mutation() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
