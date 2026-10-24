-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DOCTORS table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  qualification TEXT,
  phone         TEXT,
  email         TEXT,
  specialization TEXT,
  incentiveRate NUMERIC(5,2) NOT NULL DEFAULT 50.00, -- percentage, default 50%
  isActive      BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REPORT_INCENTIVES table — one row per report that has a referring doctor
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS report_incentives (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reportId"   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  "doctorId"   UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  billAmount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  incentiveRate NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  incentiveAmount NUMERIC(10,2) GENERATED ALWAYS AS (ROUND(billAmount * incentiveRate / 100, 2)) STORED,
  isPaid       BOOLEAN NOT NULL DEFAULT FALSE,
  paidAt       TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("reportId")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add doctorId FK to patients (links selected doctor)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "doctorId" UUID REFERENCES doctors(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Make phone optional on patients
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Gender-specific normal ranges on template_fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE template_fields
  ADD COLUMN IF NOT EXISTS "normalRangeTextMale"   TEXT,
  ADD COLUMN IF NOT EXISTS "normalRangeTextFemale" TEXT,
  ADD COLUMN IF NOT EXISTS "normalRangeMinMale"    NUMERIC,
  ADD COLUMN IF NOT EXISTS "normalRangeMaxMale"    NUMERIC,
  ADD COLUMN IF NOT EXISTS "normalRangeMinFemale"  NUMERIC,
  ADD COLUMN IF NOT EXISTS "normalRangeMaxFemale"  NUMERIC;

-- RLS: allow authenticated users to read doctors
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read doctors"
  ON doctors FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage doctors"
  ON doctors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));

ALTER TABLE report_incentives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read incentives"
  ON report_incentives FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admins can manage incentives"
  ON report_incentives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'));