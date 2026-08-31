GRANT UPDATE, DELETE ON public.screenings TO authenticated;

DROP POLICY IF EXISTS "screenings_update" ON public.screenings;
CREATE POLICY "screenings_update"
ON public.screenings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "screenings_delete" ON public.screenings;
CREATE POLICY "screenings_delete"
ON public.screenings
FOR DELETE
TO authenticated
USING (true);

GRANT DELETE ON public.anthropometric_estimates TO authenticated;

DROP POLICY IF EXISTS "estimates_delete" ON public.anthropometric_estimates;
CREATE POLICY "estimates_delete"
ON public.anthropometric_estimates
FOR DELETE
TO authenticated
USING (true);
