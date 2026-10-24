-- Add new field types to the existing enum
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'POSITIVE_NEGATIVE';
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'REACTIVE';
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'WIDAL';
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'URINE_ROUTINE';