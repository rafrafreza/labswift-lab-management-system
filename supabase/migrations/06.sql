-- THE BUG:
-- Supabase upsert with onConflict: "reportId" fails because the actual
-- DB column is "reportId" (camelCase) but Supabase REST API expects
-- the snake_case alias OR the exact quoted column name.
--
-- The safest fix is to add a unique constraint with a known name,
-- then use that name OR switch to snake_case column.
--
-- Run this in Supabase SQL Editor if the unique constraint doesn't exist yet:
ALTER TABLE report_incentives
  DROP CONSTRAINT IF EXISTS report_incentives_reportId_key;

ALTER TABLE report_incentives
  ADD CONSTRAINT report_incentives_report_id_unique UNIQUE ("reportId");