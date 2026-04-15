
-- Salary levels reference table
CREATE TABLE public.salary_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'Desenvolvedor(a)', 'Liderança Técnica', 'Arquiteto de Software'
  position text NOT NULL, -- e.g. 'Desenvolvedor(a) Junior I'
  salary_clt numeric(12,2) NOT NULL DEFAULT 0,
  salary_coop numeric(12,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read salary_levels" ON public.salary_levels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert salary_levels" ON public.salary_levels
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update salary_levels" ON public.salary_levels
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete salary_levels" ON public.salary_levels
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add squad, position and salary to team_members
ALTER TABLE public.team_members
  ADD COLUMN squad text,
  ADD COLUMN position text,
  ADD COLUMN salary numeric(12,2);

-- Seed salary levels data
INSERT INTO public.salary_levels (category, position, salary_clt, salary_coop, sort_order) VALUES
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Aprendiz', 2670.00, 4005.00, 1),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Junior I', 3560.00, 5340.00, 2),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Junior II', 3916.00, 5874.00, 3),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Junior III', 4308.00, 6462.00, 4),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Junior IV', 4739.00, 7108.50, 5),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Pleno I', 5924.00, 8886.00, 6),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Pleno II', 6516.00, 9774.00, 7),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Pleno III', 7168.00, 10752.00, 8),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Pleno IV', 7885.00, 11827.50, 9),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Senior I', 9068.00, 13602.00, 10),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Senior II', 9612.00, 14418.00, 11),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Senior III', 10189.00, 15283.50, 12),
  ('Desenvolvedor(a)', 'Desenvolvedor(a) Senior IV', 10800.00, 16200.00, 13),
  ('Liderança Técnica', 'Liderança Técnica Junior I', 5924.00, 8886.00, 14),
  ('Liderança Técnica', 'Liderança Técnica Junior II', 6516.00, 9774.00, 15),
  ('Liderança Técnica', 'Liderança Técnica Junior III', 7168.00, 10752.00, 16),
  ('Liderança Técnica', 'Liderança Técnica Junior IV', 7885.00, 11827.50, 17),
  ('Liderança Técnica', 'Liderança Técnica Pleno I', 9068.00, 13602.00, 18),
  ('Liderança Técnica', 'Liderança Técnica Pleno II', 9612.00, 14418.00, 19),
  ('Liderança Técnica', 'Liderança Técnica Pleno III', 10189.00, 15283.50, 20),
  ('Liderança Técnica', 'Liderança Técnica Pleno IV', 10800.00, 16200.00, 21),
  ('Liderança Técnica', 'Liderança Técnica Senior I', 12096.00, 18144.00, 22),
  ('Liderança Técnica', 'Liderança Técnica Senior II', 12701.00, 19051.50, 23),
  ('Liderança Técnica', 'Liderança Técnica Senior III', 13336.00, 20004.00, 24),
  ('Liderança Técnica', 'Liderança Técnica Senior IV', 14003.00, 21004.50, 25),
  ('Arquiteto de Software', 'Arquiteto de Software Junior I', 5924.00, 8886.00, 26),
  ('Arquiteto de Software', 'Arquiteto de Software Junior II', 6516.00, 9774.00, 27),
  ('Arquiteto de Software', 'Arquiteto de Software Junior III', 7168.00, 10752.00, 28),
  ('Arquiteto de Software', 'Arquiteto de Software Junior IV', 7885.00, 11827.50, 29),
  ('Arquiteto de Software', 'Arquiteto de Software Pleno I', 9068.00, 13602.00, 30),
  ('Arquiteto de Software', 'Arquiteto de Software Pleno II', 9612.00, 14418.00, 31),
  ('Arquiteto de Software', 'Arquiteto de Software Pleno III', 10189.00, 15283.50, 32),
  ('Arquiteto de Software', 'Arquiteto de Software Pleno IV', 10800.00, 16200.00, 33),
  ('Arquiteto de Software', 'Arquiteto de Software Senior I', 12096.00, 18144.00, 34),
  ('Arquiteto de Software', 'Arquiteto de Software Senior II', 12701.00, 19051.50, 35),
  ('Arquiteto de Software', 'Arquiteto de Software Senior III', 13336.00, 20004.00, 36),
  ('Arquiteto de Software', 'Arquiteto de Software Senior IV', 14003.00, 21004.50, 37);
