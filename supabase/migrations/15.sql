-- Migration 15: performance indexes
-- Run in the Supabase SQL Editor. Safe to re-run (all statements are "if not exists").
-- Numbered 15 (not 13) so it can't be confused with the demo-data scripts that were run as 13 and 14.
--
-- Why:
--   * Patient / report / template search uses ilike '%term%', which a normal btree index cannot serve.
--     Trigram (pg_trgm) GIN indexes can.
--   * Foreign keys and filter columns used by the list screens, dashboards, financials and
--     incentives had no index.

create extension if not exists pg_trgm;

-- ── Text search (ilike '%term%') ─────────────────────────────────────────────
create index if not exists patients_name_trgm_idx         on public.patients using gin ("name" gin_trgm_ops);
create index if not exists patients_code_trgm_idx         on public.patients using gin ("patientCode" gin_trgm_ops);
create index if not exists patients_phone_trgm_idx        on public.patients using gin (phone gin_trgm_ops);
create index if not exists patients_ref_doctor_trgm_idx   on public.patients using gin ("refDoctor" gin_trgm_ops);
create index if not exists reports_number_trgm_idx        on public.reports  using gin ("reportNumber" gin_trgm_ops);
create index if not exists test_templates_name_trgm_idx   on public.test_templates using gin ("name" gin_trgm_ops);

-- ── Filters, sorting and foreign keys ────────────────────────────────────────
create index if not exists reports_status_created_idx     on public.reports ("status", "createdAt" desc);
create index if not exists reports_patient_created_idx    on public.reports ("patientId", "createdAt" desc);
create index if not exists reports_created_by_idx         on public.reports ("createdById");
create index if not exists patients_doctor_id_idx         on public.patients ("doctorId");
create index if not exists patients_created_at_idx        on public.patients ("createdAt" desc);
create index if not exists report_values_field_id_idx     on public.report_values ("fieldId");
create index if not exists template_fields_template_idx   on public.template_fields ("templateId");
create index if not exists report_incentives_doctor_idx   on public.report_incentives ("doctorId");
-- lowercase, unquoted columns on this table
create index if not exists report_incentives_paid_idx     on public.report_incentives (ispaid);

analyze public.patients;
analyze public.reports;
analyze public.report_values;

NOTIFY pgrst, 'reload schema';
