CREATE TABLE IF NOT EXISTS public.print_export_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name TEXT        NOT NULL DEFAULT '',
  page          TEXT        NOT NULL,   -- 'statistics' | 'demographics'
  export_type   TEXT        NOT NULL,   -- 'print' | 'excel'
  filters       JSONB       NOT NULL DEFAULT '{}',
  status        TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'resolved'
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_by   UUID        REFERENCES public.profiles(id),
  resolved_at   TIMESTAMPTZ
);
