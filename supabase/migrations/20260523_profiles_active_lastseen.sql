-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add is_active and last_seen_at to profiles
-- Purpose  : Enables user enable/disable toggle and online status tracking
--            in the User Management panel.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add is_active column (default TRUE so all existing users stay active)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Add last_seen_at column (nullable — NULL means "never logged in")
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- ─── RLS Policies ───────────────────────────────────────────────────────────

-- Allow any authenticated user to read all profiles (needed for user list)
-- (This policy may already exist; IF EXISTS guard prevents duplication)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_authenticated'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY profiles_select_authenticated
        ON public.profiles
        FOR SELECT
        TO authenticated
        USING (true);
    $pol$;
  END IF;
END$$;

-- Allow a user to update their own last_seen_at (heartbeat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_update_own_last_seen'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY profiles_update_own_last_seen
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING     (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    $pol$;
  END IF;
END$$;

-- Allow system/master/admin roles to update is_active on any profile
-- This relies on a helper function to get the caller's role safely.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_admin_update_is_active'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY profiles_admin_update_is_active
        ON public.profiles
        FOR UPDATE
        TO authenticated
        USING (
          public.get_my_role() IN ('system', 'master', 'admin')
        )
        WITH CHECK (
          public.get_my_role() IN ('system', 'master', 'admin')
        );
    $pol$;
  END IF;
END$$;
