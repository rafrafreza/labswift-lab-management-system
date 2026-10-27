-- Migration 17: selectable PDF report design
-- Run in the Supabase SQL Editor. Safe to re-run.
-- Allowed values: modern (the original look, default), classic, executive, minimal.

ALTER TABLE public.lab_settings
  ADD COLUMN IF NOT EXISTS "reportTemplate" text NOT NULL DEFAULT 'modern';

ALTER TABLE public.lab_settings
  DROP CONSTRAINT IF EXISTS lab_settings_report_template_check;
ALTER TABLE public.lab_settings
  ADD CONSTRAINT lab_settings_report_template_check
  CHECK ("reportTemplate" IN ('modern', 'classic', 'executive', 'minimal'));

NOTIFY pgrst, 'reload schema';
