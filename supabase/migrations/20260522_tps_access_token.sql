-- ══════════════════════════════════════════════════════════════════════════
--  TPS Weekly Access Token
--  • One row only (id = 1).
--  • token_hash  : bcrypt hash of the 6-digit code (pgcrypto).
--  • expires_at  : UTC timestamp — rotated weekly by admin.
--  • created_at  : audit timestamp.
--
--  Security model
--  ──────────────
--  • Table is NOT exposed to the public schema anon/authenticated roles.
--  • Verification is done entirely inside a SECURITY DEFINER RPC so the
--    raw hash never leaves the database.
--  • The plaintext code is never stored — only bcrypt(cost=12) hash.
--  • Rate limiting: consecutive wrong attempts are tracked in a separate
--    counter column; after 10 wrong guesses the token is locked until
--    the admin resets it.
-- ══════════════════════════════════════════════════════════════════════════

-- Require pgcrypto (available on all Supabase projects)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tps_access_token (
  id            INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  token_hash    TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  fail_count    INT         NOT NULL DEFAULT 0,
  locked        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with a placeholder hash (admin must set a real code via the dashboard)
-- We use the string 'UNSET' hashed so no accidental match is possible
INSERT INTO public.tps_access_token (id, token_hash, expires_at)
VALUES (
  1,
  crypt('UNSET', gen_salt('bf', 12)),
  now() + INTERVAL '7 days'
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS: deny direct table access to everyone ─────────────────────────────
ALTER TABLE public.tps_access_token ENABLE ROW LEVEL SECURITY;

-- No SELECT / INSERT / UPDATE / DELETE policies → table is invisible to all roles.
-- Access is ONLY through the SECURITY DEFINER functions below.

-- ══════════════════════════════════════════════════════════════════════════
--  RPC 1: verify_access_token(candidate TEXT) → BOOLEAN
--  Called by the unauthenticated gate page.
--  Returns TRUE only when:
--    1. Token is not locked.
--    2. Token has not expired.
--    3. bcrypt match succeeds.
--  On wrong guess: increments fail_count; locks after 10 attempts.
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.verify_access_token(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec       public.tps_access_token%ROWTYPE;
  matched   BOOLEAN;
BEGIN
  SELECT * INTO rec FROM public.tps_access_token WHERE id = 1;

  -- No token configured
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Locked out
  IF rec.locked THEN
    RETURN FALSE;
  END IF;

  -- Expired
  IF rec.expires_at < now() THEN
    RETURN FALSE;
  END IF;

  -- Constant-time bcrypt comparison
  matched := (crypt(candidate, rec.token_hash) = rec.token_hash);

  IF matched THEN
    -- Reset fail counter on success
    UPDATE public.tps_access_token SET fail_count = 0 WHERE id = 1;
    RETURN TRUE;
  ELSE
    -- Increment fail counter; lock after 10 consecutive failures
    UPDATE public.tps_access_token
    SET
      fail_count = rec.fail_count + 1,
      locked     = (rec.fail_count + 1 >= 10)
    WHERE id = 1;
    RETURN FALSE;
  END IF;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  RPC 2: set_access_token(new_code TEXT) → VOID
--  Called by system/master admin from UserManagement dashboard.
--  Hashes the new 6-digit code and stores it with a 7-day expiry.
--  Resets fail_count and locked flag.
--  Restricted to authenticated users whose profile.role is
--  'system' or 'master' (enforced inside the function).
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_access_token(new_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Verify caller is a privileged role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN ('system', 'master', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient role';
  END IF;

  -- Validate: must be exactly 6 digits
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

-- ══════════════════════════════════════════════════════════════════════════
--  RPC 3: get_access_token_status() → TABLE
--  Returns metadata only (NO hash). Used by admin dashboard to show
--  expiry date, fail count, locked status.
--  Restricted to system/master/admin roles.
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_access_token_status()
RETURNS TABLE(expires_at TIMESTAMPTZ, fail_count INT, locked BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF caller_role NOT IN ('system', 'master', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient role';
  END IF;

  RETURN QUERY
  SELECT t.expires_at, t.fail_count, t.locked, t.created_at
  FROM public.tps_access_token t
  WHERE t.id = 1;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
--  Grant EXECUTE on RPCs to anon + authenticated
--  (The functions themselves enforce all security internally)
-- ══════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.verify_access_token(TEXT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_access_token(TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_access_token_status()    TO authenticated;
