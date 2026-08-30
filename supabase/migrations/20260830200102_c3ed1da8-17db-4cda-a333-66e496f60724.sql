ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS mother_name text;
ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS diet_note text;
ALTER TABLE public.screenings ADD COLUMN IF NOT EXISTS nan_level text;
ALTER TABLE public.screenings ADD COLUMN IF NOT EXISTS next_screening_at timestamp with time zone;