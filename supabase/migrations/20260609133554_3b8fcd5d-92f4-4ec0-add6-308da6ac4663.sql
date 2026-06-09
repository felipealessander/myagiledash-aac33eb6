
-- Restrict write access on report_tasks to approved users
DROP POLICY IF EXISTS "Authenticated insert report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Authenticated update report_tasks" ON public.report_tasks;
DROP POLICY IF EXISTS "Authenticated delete report_tasks" ON public.report_tasks;

CREATE POLICY "Approved users insert report_tasks"
ON public.report_tasks FOR INSERT TO authenticated
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users update report_tasks"
ON public.report_tasks FOR UPDATE TO authenticated
USING (public.is_approved(auth.uid()))
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users delete report_tasks"
ON public.report_tasks FOR DELETE TO authenticated
USING (public.is_approved(auth.uid()));

-- Same for sprint_reports
DROP POLICY IF EXISTS "Authenticated insert sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Authenticated update sprint_reports" ON public.sprint_reports;
DROP POLICY IF EXISTS "Authenticated delete sprint_reports" ON public.sprint_reports;

CREATE POLICY "Approved users insert sprint_reports"
ON public.sprint_reports FOR INSERT TO authenticated
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users update sprint_reports"
ON public.sprint_reports FOR UPDATE TO authenticated
USING (public.is_approved(auth.uid()))
WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "Approved users delete sprint_reports"
ON public.sprint_reports FOR DELETE TO authenticated
USING (public.is_approved(auth.uid()));
