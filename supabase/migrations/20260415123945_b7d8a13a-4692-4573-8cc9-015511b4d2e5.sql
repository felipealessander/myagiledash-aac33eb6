
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated delete team_members" ON public.team_members;

-- Authenticated users can read (needed for tooltips on dashboard)
CREATE POLICY "Authenticated read team_members"
ON public.team_members FOR SELECT
TO authenticated
USING (true);

-- Only admins can write
CREATE POLICY "Admins can insert team_members"
ON public.team_members FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update team_members"
ON public.team_members FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete team_members"
ON public.team_members FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
