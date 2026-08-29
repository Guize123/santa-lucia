-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','nutricionista','visualizador');
CREATE TYPE public.care_type AS ENUM ('particular','sus','uti');
CREATE TYPE public.race_type AS ENUM ('branca','preta','parda','amarela','indigena','nao_informado');
CREATE TYPE public.measure_source AS ENUM ('aferido','estimado','relatado');
CREATE TYPE public.admission_status AS ENUM ('ativa','alta');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_upsert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- STRUCTURE
CREATE TABLE public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  care_type public.care_type NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.wards TO authenticated;
GRANT ALL ON public.wards TO service_role;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wards_select" ON public.wards FOR SELECT TO authenticated USING (true);
CREATE POLICY "wards_insert" ON public.wards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wards_update" ON public.wards FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid NOT NULL REFERENCES public.wards(id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_insert" ON public.rooms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rooms_update" ON public.rooms FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id uuid NOT NULL REFERENCES public.wards(id),
  room_id uuid REFERENCES public.rooms(id),
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.beds TO authenticated;
GRANT ALL ON public.beds TO service_role;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "beds_select" ON public.beds FOR SELECT TO authenticated USING (true);
CREATE POLICY "beds_insert" ON public.beds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "beds_update" ON public.beds FOR UPDATE TO authenticated USING (true);

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  birth_date date,
  sex text,
  race public.race_type NOT NULL DEFAULT 'nao_informado',
  medical_record text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_select" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "patients_insert" ON public.patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "patients_update" ON public.patients FOR UPDATE TO authenticated USING (true);

-- ADMISSIONS
CREATE TABLE public.admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  bed_id uuid NOT NULL REFERENCES public.beds(id),
  care_type public.care_type NOT NULL,
  status public.admission_status NOT NULL DEFAULT 'ativa',
  admitted_at timestamptz NOT NULL DEFAULT now(),
  discharged_at timestamptz,
  main_diagnosis text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admissions_one_active_per_bed ON public.admissions (bed_id) WHERE (status = 'ativa');
CREATE UNIQUE INDEX admissions_one_active_per_patient ON public.admissions (patient_id) WHERE (status = 'ativa');
GRANT SELECT, INSERT, UPDATE ON public.admissions TO authenticated;
GRANT ALL ON public.admissions TO service_role;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admissions_select" ON public.admissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admissions_insert" ON public.admissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admissions_update" ON public.admissions FOR UPDATE TO authenticated USING (true);

-- SCREENINGS
CREATE TABLE public.screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id uuid NOT NULL REFERENCES public.admissions(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  screened_at timestamptz NOT NULL DEFAULT now(),
  professional_id uuid,
  professional_name text NOT NULL DEFAULT '',
  is_reassessment boolean NOT NULL DEFAULT false,
  weight_kg numeric(6,2),
  weight_source public.measure_source,
  weight_method text,
  height_cm numeric(6,2),
  height_source public.measure_source,
  height_method text,
  bmi numeric(6,2),
  usual_weight_kg numeric(6,2),
  weight_loss_percentage numeric(6,2),
  weight_loss_period_months numeric(5,1),
  arm_circumference_cm numeric(6,2),
  calf_circumference_cm numeric(6,2),
  knee_height_cm numeric(6,2),
  subscapular_skinfold_mm numeric(6,2),
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  appetite text,
  intake_acceptance text,
  chewing text,
  swallowing text,
  diet_type text,
  feeding_route text,
  feeding_notes text,
  clinical_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.screenings TO authenticated;
GRANT ALL ON public.screenings TO service_role;
ALTER TABLE public.screenings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screenings_select" ON public.screenings FOR SELECT TO authenticated USING (true);
CREATE POLICY "screenings_insert" ON public.screenings FOR INSERT TO authenticated WITH CHECK (true);

-- AUDIT OF ESTIMATES
CREATE TABLE public.anthropometric_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id uuid REFERENCES public.screenings(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  target text NOT NULL,
  method text NOT NULL,
  formula text NOT NULL,
  protocol text,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result numeric(8,2),
  unit text,
  professional_id uuid,
  professional_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.anthropometric_estimates TO authenticated;
GRANT ALL ON public.anthropometric_estimates TO service_role;
ALTER TABLE public.anthropometric_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estimates_select" ON public.anthropometric_estimates FOR SELECT TO authenticated USING (true);
CREATE POLICY "estimates_insert" ON public.anthropometric_estimates FOR INSERT TO authenticated WITH CHECK (true);

-- DEMO DATA (fictitious)
INSERT INTO public.wards (id, name, care_type, description) VALUES
  ('11111111-1111-1111-1111-111111111111','Ala 18','particular','Internação particular - 4º andar'),
  ('22222222-2222-2222-2222-222222222222','Ala B','sus','Internação SUS - 2º andar'),
  ('33333333-3333-3333-3333-333333333333','UTI Adulto','uti','Unidade de Terapia Intensiva Adulto');

INSERT INTO public.rooms (id, ward_id, name) VALUES
  ('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Quarto 1801'),
  ('aaaaaaa1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Quarto 1802'),
  ('aaaaaaa1-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','Enfermaria B1');

INSERT INTO public.beds (id, ward_id, room_id, label) VALUES
  ('bbbbbbb1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','Leito 1801-A'),
  ('bbbbbbb1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000001','Leito 1801-B'),
  ('bbbbbbb1-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','aaaaaaa1-0000-0000-0000-000000000002','Leito 1802-A'),
  ('bbbbbbb1-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003','Leito B1-01'),
  ('bbbbbbb1-0000-0000-0000-000000000005','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003','Leito B1-02'),
  ('bbbbbbb1-0000-0000-0000-000000000006','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000003','Leito B1-03'),
  ('bbbbbbb1-0000-0000-0000-000000000007','33333333-3333-3333-3333-333333333333',NULL,'Leito UTI 01'),
  ('bbbbbbb1-0000-0000-0000-000000000008','33333333-3333-3333-3333-333333333333',NULL,'Leito UTI 02'),
  ('bbbbbbb1-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333',NULL,'Leito UTI 03');

INSERT INTO public.patients (id, full_name, birth_date, sex, race, medical_record, notes) VALUES
  ('ccccccc1-0000-0000-0000-000000000001','Maria Aparecida Fictícia','1948-03-12','F','branca','PRT-1001','Paciente fictícia de demonstração'),
  ('ccccccc1-0000-0000-0000-000000000002','João Batista Exemplo','1962-07-30','M','preta','PRT-1002','Paciente fictício de demonstração'),
  ('ccccccc1-0000-0000-0000-000000000003','Rosa Kimura Demonstração','1955-11-02','F','amarela','PRT-1003','Paciente fictícia de demonstração'),
  ('ccccccc1-0000-0000-0000-000000000004','Antônio Silva Modelo','1971-01-25','M','parda','PRT-1004','Paciente fictício de demonstração'),
  ('ccccccc1-0000-0000-0000-000000000005','Benedita Tupã Ilustrativa','1980-09-18','F','indigena','PRT-1005','Paciente fictícia de demonstração');

INSERT INTO public.admissions (id, patient_id, bed_id, care_type, status, admitted_at, main_diagnosis) VALUES
  ('ddddddd1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000001','bbbbbbb1-0000-0000-0000-000000000001','particular','ativa', now() - interval '4 days','Pós-operatório de artroplastia de quadril'),
  ('ddddddd1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000002','bbbbbbb1-0000-0000-0000-000000000004','sus','ativa', now() - interval '9 days','DPOC exacerbado'),
  ('ddddddd1-0000-0000-0000-000000000003','ccccccc1-0000-0000-0000-000000000003','bbbbbbb1-0000-0000-0000-000000000005','sus','ativa', now() - interval '2 days','Infecção do trato urinário'),
  ('ddddddd1-0000-0000-0000-000000000004','ccccccc1-0000-0000-0000-000000000004','bbbbbbb1-0000-0000-0000-000000000007','uti','ativa', now() - interval '6 days','Sepse de foco abdominal'),
  ('ddddddd1-0000-0000-0000-000000000005','ccccccc1-0000-0000-0000-000000000005','bbbbbbb1-0000-0000-0000-000000000003','particular','alta', now() - interval '20 days','Pneumonia comunitária');
UPDATE public.admissions SET discharged_at = now() - interval '12 days' WHERE id = 'ddddddd1-0000-0000-0000-000000000005';

INSERT INTO public.screenings (admission_id, patient_id, screened_at, professional_name, weight_kg, weight_source, weight_method, height_cm, height_source, height_method, bmi, usual_weight_kg, weight_loss_percentage, weight_loss_period_months, conditions, appetite, chewing, swallowing, diet_type, feeding_route, clinical_notes) VALUES
  ('ddddddd1-0000-0000-0000-000000000001','ccccccc1-0000-0000-0000-000000000001', now() - interval '3 days','Nutricionista Demo', 62.40,'aferido','Balança de plataforma', 158.00,'aferido','Estadiômetro', 25.00, 66.00, 5.45, 3.0, '{"nausea":false,"vomito":false,"diarreia":false,"constipacao":true,"disfagia":false,"dor":true}'::jsonb,'Reduzido','Preservada','Preservada','Branda','Via oral','Aceitação parcial da dieta ofertada.'),
  ('ddddddd1-0000-0000-0000-000000000002','ccccccc1-0000-0000-0000-000000000002', now() - interval '5 days','Nutricionista Demo', 58.00,'estimado','Chumlea (braço e joelho)', 170.20,'estimado','Chumlea (altura do joelho)', 20.02, 64.00, 9.38, 6.0, '{"nausea":false,"vomito":false,"diarreia":false,"constipacao":false,"disfagia":false,"dispneia":true}'::jsonb,'Muito reduzido','Prejudicada','Preservada','Livre','Via oral','Paciente acamado, medidas estimadas.');