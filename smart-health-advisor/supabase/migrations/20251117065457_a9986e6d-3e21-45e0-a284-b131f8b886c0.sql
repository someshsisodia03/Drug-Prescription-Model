-- Create medications table to store the medication dataset
CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active_ingredients TEXT[],
  symptoms TEXT[],
  diseases TEXT[],
  dosage TEXT,
  risk_factors TEXT[],
  interactions TEXT[],
  contraindications TEXT[],
  safety_score INTEGER CHECK (safety_score >= 0 AND safety_score <= 100),
  side_effects TEXT[],
  age_restrictions TEXT,
  pregnancy_category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster symptom searches
CREATE INDEX IF NOT EXISTS idx_medications_symptoms ON public.medications USING GIN(symptoms);

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Allow public read access (medications are reference data)
CREATE POLICY "Anyone can view medications"
  ON public.medications
  FOR SELECT
  USING (true);

-- Create prescriptions table to store user queries and results
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0 AND age < 150),
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  symptoms TEXT[] NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for prescriptions
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can create prescriptions (public app)
CREATE POLICY "Anyone can create prescriptions"
  ON public.prescriptions
  FOR INSERT
  WITH CHECK (true);

-- Anyone can view their own prescriptions (by id for now, since no auth)
CREATE POLICY "Anyone can view prescriptions"
  ON public.prescriptions
  FOR SELECT
  USING (true);