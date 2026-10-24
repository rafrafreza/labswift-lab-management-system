-- 12.sql: Add useSignature to lab_settings
ALTER TABLE public.lab_settings
ADD COLUMN IF NOT EXISTS "useSignature" boolean NOT NULL DEFAULT true;
