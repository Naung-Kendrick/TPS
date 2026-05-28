-- Enable RLS on print_export_requests
ALTER TABLE public.print_export_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own requests
CREATE POLICY "Users can insert own requests"
  ON public.print_export_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- All authenticated users can read requests (admins need to see all)
CREATE POLICY "Authenticated users can read all requests"
  ON public.print_export_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can update requests (for resolving)
CREATE POLICY "Authenticated users can update requests"
  ON public.print_export_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
