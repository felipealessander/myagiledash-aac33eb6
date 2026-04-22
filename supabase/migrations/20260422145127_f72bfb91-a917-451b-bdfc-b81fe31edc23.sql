
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  classification TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, classification)
);

CREATE TABLE public.client_monthly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  contracted_hours NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, month)
);

CREATE INDEX idx_client_monthly_hours_month ON public.client_monthly_hours(month);
CREATE INDEX idx_clients_active ON public.clients(active);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_monthly_hours ENABLE ROW LEVEL SECURITY;

-- clients policies
CREATE POLICY "Authenticated read clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Gestor insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- client_monthly_hours policies
CREATE POLICY "Authenticated read client_monthly_hours"
  ON public.client_monthly_hours FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Gestor insert client_monthly_hours"
  ON public.client_monthly_hours FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor update client_monthly_hours"
  ON public.client_monthly_hours FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor delete client_monthly_hours"
  ON public.client_monthly_hours FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_client_monthly_hours_updated_at
  BEFORE UPDATE ON public.client_monthly_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
