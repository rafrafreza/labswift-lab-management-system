-- Migration 16: lab tagline (shown under the logo on PDF reports)
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.lab_settings
  ADD COLUMN IF NOT EXISTS "tagline" text;

-- Reports used to print a fixed tagline under the logo. Keep that text for existing labs so
-- their PDFs don't change until they edit it in Settings (clear the field to show no tagline).
UPDATE public.lab_settings
SET "tagline" = E'Precision in Diagnosis,\nCare in Every Slide.'
WHERE "tagline" IS NULL;

NOTIFY pgrst, 'reload schema';
