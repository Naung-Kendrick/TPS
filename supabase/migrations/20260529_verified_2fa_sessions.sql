-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Server-side 2FA (Email OTP) session verification tracking
-- Purpose  : Ensures a Supabase Auth session cannot access the app or protected
--            RLS/RPC data until Email OTP has been verified for that session_id.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.verified_2fa_sessions (
  session_id  TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verified_2fa_sessions_user_id
  ON public.verified_2fa_sessions (user_id);

-- Deny all direct client access; only Edge Functions (service_role) & SECURITY DEFINER RPCs touch this table.
ALTER TABLE public.verified_2fa_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verified_2fa_sessions_deny_all ON public.verified_2fa_sessions;
CREATE POLICY verified_2fa_sessions_deny_all
  ON public.verified_2fa_sessions
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Check whether the current JWT's session_id has passed Email OTP verification
CREATE OR REPLACE FUNCTION public.is_2fa_verified()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt() ->> 'session_id', '') <> ''
    AND EXISTS (
      SELECT 1
      FROM public.verified_2fa_sessions v
      WHERE v.session_id = (auth.jwt() ->> 'session_id')
        AND v.user_id = auth.uid()
    );
$$;

-- Revoke the current session's 2FA verification on logout
CREATE OR REPLACE FUNCTION public.revoke_current_2fa_session()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid TEXT;
BEGIN
  sid := auth.jwt() ->> 'session_id';
  IF auth.uid() IS NOT NULL AND COALESCE(sid, '') <> '' THEN
    DELETE FROM public.verified_2fa_sessions
    WHERE session_id = sid AND user_id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_2fa_verified() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_current_2fa_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_2fa_verified() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_current_2fa_session() TO authenticated;
