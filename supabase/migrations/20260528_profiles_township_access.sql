ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allowed_townships TEXT[] NOT NULL DEFAULT '{}';
