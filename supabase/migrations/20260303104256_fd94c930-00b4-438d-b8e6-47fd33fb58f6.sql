
-- sprint_reports: keep public SELECT, restrict write to authenticated
DROP POLICY IF EXISTS "Public insert sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Public update sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Public delete sprint_reports" ON public.sprint_reports;

CREATE POLICY "Authenticated insert sprint_reports" ON public.sprint_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update sprint_reports" ON public.sprint_reports
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated delete sprint_reports" ON public.sprint_reports
  FOR DELETE TO authenticated
  USING (true);

-- report_tasks: keep public SELECT, restrict write to authenticated
DROP POLICY IF EXISTS "Public insert report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Public update report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Public delete report_tasks" ON public.report_tasks;

CREATE POLICY "Authenticated insert report_tasks" ON public.report_tasks
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update report_tasks" ON public.report_tasks
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated delete report_tasks" ON public.report_tasks
  FOR DELETE TO authenticated
  USING (true);
