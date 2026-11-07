-- Migration 21: atomic report save
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Problem: saving a report was several separate requests (insert report, then insert values; or delete values,
-- insert values, update report). If a later step failed (network drop, bad value) the earlier ones stayed:
-- an empty report, or an edited report that had lost all its results.
--
-- Fix: one function call = one transaction. Either everything is saved or nothing is (the report number counter
-- is rolled back too, so failed saves don't leave gaps in the numbering).
--
-- The functions run as the CALLER (security invoker), so row-level security and the finalised-report locks from
-- 18.sql apply exactly as before. As in the old code, the values are rewritten before the status is changed, so a
-- non-admin can still complete a draft; finalised reports stay locked for them.

create or replace function public.create_report_atomic(p_report jsonb, p_values jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.report_status_type := coalesce(p_report ->> 'status', 'FINAL')::public.report_status_type;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) = 0 then
    raise exception 'A report needs at least one result value.';
  end if;

  insert into public.reports (
    "reportNumber", "patientId", "templateId", "createdById", status, "collectedAt", "reportedAt", notes,
    "billAmount", "discountType", discount, "amountPaid", "paymentStatus"
  )
  values (
    public.next_report_number(),
    (p_report ->> 'patientId')::uuid,
    (p_report ->> 'templateId')::uuid,
    auth.uid(),
    v_status,
    coalesce((p_report ->> 'collectedAt')::timestamptz, now()),
    case when v_status <> 'DRAFT' then now() end,
    nullif(btrim(p_report ->> 'notes'), ''),
    (p_report ->> 'billAmount')::numeric,
    coalesce(p_report ->> 'discountType', 'FLAT'),
    coalesce((p_report ->> 'discount')::numeric, 0),
    (p_report ->> 'amountPaid')::numeric,
    coalesce(p_report ->> 'paymentStatus', 'UNPAID')
  )
  returning id into v_id;

  insert into public.report_values ("reportId", "fieldId", value, "isAbnormal")
  select v_id, (v ->> 'fieldId')::uuid, v ->> 'value', coalesce((v ->> 'isAbnormal')::boolean, false)
  from jsonb_array_elements(p_values) v;

  return v_id;
end;
$$;

create or replace function public.update_report_atomic(p_report_id uuid, p_report jsonb, p_values jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status public.report_status_type := (p_report ->> 'status')::public.report_status_type;
  v_found uuid;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) = 0 then
    raise exception 'A report needs at least one result value.';
  end if;

  select id into v_found from public.reports where id = p_report_id for update;
  if v_found is null then
    raise exception 'Report not found.';
  end if;

  -- Values first (while a draft is still a draft), the report row last
  delete from public.report_values where "reportId" = p_report_id;

  insert into public.report_values ("reportId", "fieldId", value, "isAbnormal")
  select p_report_id, (v ->> 'fieldId')::uuid, v ->> 'value', coalesce((v ->> 'isAbnormal')::boolean, false)
  from jsonb_array_elements(p_values) v;

  update public.reports
  set status = v_status,
      "collectedAt" = (p_report ->> 'collectedAt')::timestamptz,
      "reportedAt" = case when v_status <> 'DRAFT' then now() end,
      notes = nullif(btrim(p_report ->> 'notes'), ''),
      "billAmount"    = case when p_report ? 'billAmount'    then (p_report ->> 'billAmount')::numeric        else "billAmount" end,
      "discountType"  = case when p_report ? 'billAmount'    then coalesce(p_report ->> 'discountType', 'FLAT') else "discountType" end,
      discount        = case when p_report ? 'billAmount'    then coalesce((p_report ->> 'discount')::numeric, 0) else discount end,
      "amountPaid"    = case when p_report ? 'billAmount'    then (p_report ->> 'amountPaid')::numeric        else "amountPaid" end,
      "paymentStatus" = case when p_report ? 'billAmount'    then coalesce(p_report ->> 'paymentStatus', 'PAID') else "paymentStatus" end
  where id = p_report_id;

  return p_report_id;
end;
$$;

revoke execute on function public.create_report_atomic(jsonb, jsonb) from public, anon;
revoke execute on function public.update_report_atomic(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_report_atomic(jsonb, jsonb) to authenticated, service_role;
grant execute on function public.update_report_atomic(uuid, jsonb, jsonb) to authenticated, service_role;

NOTIFY pgrst, 'reload schema';
