-- Migration 11: Patient Age Months, Template Field Soft Delete, and Billing/Discount tracking
-- Run this in your Supabase SQL Editor.

-- 1. Add ageMonths to patients (0 to 11 months, default 0)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS "ageMonths" integer NOT NULL DEFAULT 0;

-- 2. Add isActive to template_fields so fields can be soft-deleted without violating FK constraints on past reports
ALTER TABLE public.template_fields
  ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

-- 3. Ensure billing and discount columns exist on reports table
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS "billAmount"     numeric(10,2),
  ADD COLUMN IF NOT EXISTS "discountType"   text check ("discountType" in ('FLAT','PERCENT')) default 'FLAT',
  ADD COLUMN IF NOT EXISTS "discount"       numeric(10,2) not null default 0,
  ADD COLUMN IF NOT EXISTS "amountPaid"     numeric(10,2),
  ADD COLUMN IF NOT EXISTS "paymentStatus"  text check ("paymentStatus" in ('PAID','PARTIAL','UNPAID','FREE')) not null default 'PAID';

-- 4. Enable authenticated staff and admins to update templates and fields smoothly
DROP POLICY IF EXISTS "templates_update_authenticated" ON public.test_templates;
CREATE POLICY "templates_update_authenticated"
  ON public.test_templates FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "fields_update_authenticated" ON public.template_fields;
CREATE POLICY "fields_update_authenticated"
  ON public.template_fields FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "fields_insert_authenticated" ON public.template_fields;
CREATE POLICY "fields_insert_authenticated"
  ON public.template_fields FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "fields_delete_authenticated" ON public.template_fields;
CREATE POLICY "fields_delete_authenticated"
  ON public.template_fields FOR DELETE TO authenticated
  USING (true);

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
