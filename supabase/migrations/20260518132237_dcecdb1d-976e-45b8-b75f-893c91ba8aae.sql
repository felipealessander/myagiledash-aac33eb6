
-- 1. Restrict team_members SELECT to admin/gestor
DROP POLICY IF EXISTS "Authenticated read team_members" ON public.team_members;
CREATE POLICY "Admin/Gestor read team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 2. Safe directory view for non-sensitive team member fields
CREATE OR REPLACE VIEW public.team_members_directory
  WITH (security_invoker = true) AS
  SELECT id, name, username, squad, active
  FROM public.team_members;

GRANT SELECT ON public.team_members_directory TO authenticated;

-- Allow authenticated users to read via the view by adding a permissive SELECT
-- policy scoped to the columns the view exposes is not possible at row level,
-- so we create a parallel SELECT policy that only matches when the underlying
-- query is from the directory view via a SECURITY DEFINER function.
CREATE OR REPLACE FUNCTION public.list_team_directory()
RETURNS TABLE(id uuid, name text, username text, squad text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, username, squad, active
  FROM public.team_members
  WHERE active = true
  ORDER BY name;
$$;

GRANT EXECUTE ON FUNCTION public.list_team_directory() TO authenticated;

-- 3. Restrict salary_levels SELECT to admin/gestor
DROP POLICY IF EXISTS "Authenticated can read salary_levels" ON public.salary_levels;
CREATE POLICY "Admin/Gestor read salary_levels"
  ON public.salary_levels FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 4. Restrict report_tasks and sprint_reports to authenticated users
DROP POLICY IF EXISTS "Public read report_tasks" ON public.report_tasks;
CREATE POLICY "Authenticated read report_tasks"
  ON public.report_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Public read sprint_reports" ON public.sprint_reports;
CREATE POLICY "Authenticated read sprint_reports"
  ON public.sprint_reports FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 5. Realtime channel authorization: require authenticated users
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
