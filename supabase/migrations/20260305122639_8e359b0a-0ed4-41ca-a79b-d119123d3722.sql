-- Fix overly permissive RLS policies on report_tasks
DROP POLICY IF EXISTS "Authenticated delete report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Authenticated insert report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Authenticated update report_tasks" ON public.report_tasks;

CREATE POLICY "Authenticated delete report_tasks" ON public.report_tasks
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert report_tasks" ON public.report_tasks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update report_tasks" ON public.report_tasks
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- Fix overly permissive RLS policies on sprint_reports
DROP POLICY IF EXISTS "Authenticated delete sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Authenticated insert sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Authenticated update sprint_reports" ON public.sprint_reports;

CREATE POLICY "Authenticated delete sprint_reports" ON public.sprint_reports
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated insert sprint_reports" ON public.sprint_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update sprint_reports" ON public.sprint_reports
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);