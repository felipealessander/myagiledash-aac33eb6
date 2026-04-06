
DROP POLICY "System can insert profiles" ON public.profiles;

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());
