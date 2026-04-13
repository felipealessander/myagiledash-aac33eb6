ALTER TABLE public.report_tasks
ADD COLUMN slo_date timestamp with time zone DEFAULT NULL,
ADD COLUMN promised_date timestamp with time zone DEFAULT NULL;