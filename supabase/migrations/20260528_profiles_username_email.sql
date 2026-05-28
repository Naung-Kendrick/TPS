-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add username and email columns to profiles
-- Purpose  : username is the display login name; email is for OTP 2FA
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;
