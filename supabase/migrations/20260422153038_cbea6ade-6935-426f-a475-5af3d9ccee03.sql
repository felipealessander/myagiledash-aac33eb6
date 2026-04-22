-- Remove non-Sob Demanda clients and their monthly hours (no longer used in this phase)
DELETE FROM public.client_monthly_hours WHERE client_id IN (SELECT id FROM public.clients WHERE classification <> 'Sob Demanda');
DELETE FROM public.clients WHERE classification <> 'Sob Demanda';