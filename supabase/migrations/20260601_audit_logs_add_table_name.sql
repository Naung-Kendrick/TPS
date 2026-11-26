-- ============================================================================
-- Migration: Ensure public.audit_logs has table_name column
-- Live databases that created audit_logs prior to 20260530 did not get
-- table_name via CREATE TABLE IF NOT EXISTS, causing trigger inserts to fail.
-- ============================================================================

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS table_name TEXT;
