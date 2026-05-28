-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Create otp_codes table for custom email OTP 2FA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.otp_codes (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  attempts   INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the service role (edge functions) can read/write this table.
-- No RLS policies needed for authenticated users — edge functions use service role.
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access (edge functions bypass RLS via service role)
CREATE POLICY otp_codes_deny_all ON public.otp_codes
  FOR ALL TO authenticated USING (false);

-- Also add username and email columns to profiles if not already present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;
