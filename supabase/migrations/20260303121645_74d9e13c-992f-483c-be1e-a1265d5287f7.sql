
ALTER TABLE public.report_tasks ADD COLUMN created_at_yt timestamp with time zone;
ALTER TABLE public.report_tasks ADD COLUMN resolved_at timestamp with time zone;
ALTER TABLE public.report_tasks ADD COLUMN status text;
