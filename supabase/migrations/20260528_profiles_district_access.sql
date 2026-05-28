-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add district-level access control to profiles
-- access_level: 'central' (sees all) or 'district' (restricted to allowed_districts)
-- allowed_districts: array of district names the user can access
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'central';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_districts TEXT[] NOT NULL DEFAULT '{}';
