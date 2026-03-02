
-- Table for monthly sprint reports
CREATE TABLE public.sprint_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month TEXT NOT NULL, -- "2025-01" format
  label TEXT, -- e.g. "Janeiro 2025"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month)
);

ALTER TABLE public.sprint_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sprint_reports" ON public.sprint_reports FOR SELECT USING (true);
CREATE POLICY "Public insert sprint_reports" ON public.sprint_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sprint_reports" ON public.sprint_reports FOR UPDATE USING (true);
CREATE POLICY "Public delete sprint_reports" ON public.sprint_reports FOR DELETE USING (true);

-- Table for individual tasks within a report
CREATE TABLE public.report_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.sprint_reports(id) ON DELETE CASCADE,
  task_code TEXT NOT NULL,
  title TEXT,
  category TEXT, -- Atendimento, Auxílio técnico, Erro script, Incidente, Melhoria, Tarefa, Épico
  billing_status TEXT, -- Faturável, Não Faturável, Nenhum Faturável
  estimated_minutes INTEGER DEFAULT 0,
  spent_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.report_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read report_tasks" ON public.report_tasks FOR SELECT USING (true);
CREATE POLICY "Public insert report_tasks" ON public.report_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update report_tasks" ON public.report_tasks FOR UPDATE USING (true);
CREATE POLICY "Public delete report_tasks" ON public.report_tasks FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX idx_report_tasks_report_id ON public.report_tasks(report_id);
CREATE INDEX idx_report_tasks_task_code ON public.report_tasks(task_code);
