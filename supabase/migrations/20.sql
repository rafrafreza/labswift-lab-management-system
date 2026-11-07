-- Migration 20: optional QR code on PDF reports (scan to get the report PDF, no login needed)
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- How it works
--   * every report gets a long random "publicToken" (about 244 bits, not guessable). It is the only thing in the QR code URL.
--   * the public page /r/<token> calls get_public_report(), the ONLY thing the anonymous role may run. It returns that
--     one report if (and only if) it is FINAL or SENT: no drafts, no billing, no patient phone / email / address.
--   * no table is opened to anonymous users; RLS stays as set up in 18.sql.
--   * the lab turns the QR code on/off in Settings ("showQrCode", off by default).
--
-- To invalidate a report's link (e.g. it was shared by mistake), run:
--   update public.reports set "publicToken" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
--   where "reportNumber" = 'LAB-2026-00001';

alter table public.lab_settings
  add column if not exists "showQrCode" boolean not null default false;

-- A volatile default is evaluated per row, so existing reports are back-filled with distinct tokens too
alter table public.reports
  add column if not exists "publicToken" text not null
  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));

create unique index if not exists reports_public_token_key on public.reports ("publicToken");

create or replace function public.get_public_report(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_result jsonb;
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 200 then
    return null;
  end if;

  select * into v_report
  from public.reports
  where "publicToken" = p_token
    and status in ('FINAL', 'SENT');

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'report', jsonb_build_object(
      'id', v_report.id,
      'reportNumber', v_report."reportNumber",
      'patientId', v_report."patientId",
      'templateId', v_report."templateId",
      'createdById', v_report."createdById",
      'status', v_report.status,
      'collectedAt', v_report."collectedAt",
      'reportedAt', v_report."reportedAt",
      'notes', v_report.notes,
      'createdAt', v_report."createdAt",
      'updatedAt', v_report."updatedAt",
      'publicToken', v_report."publicToken",
      'patient', (
        select jsonb_build_object(
          'id', p.id,
          'patientCode', p."patientCode",
          'name', p."name",
          'age', p.age,
          'ageMonths', p."ageMonths",
          'gender', p.gender,
          'refDoctor', p."refDoctor",
          'doctor', (
            select jsonb_build_object(
              'name', d."name",
              'qualification', d.qualification,
              'specialization', d.specialization
            )
            from public.doctors d
            where d.id = p."doctorId"
          )
        )
        from public.patients p
        where p.id = v_report."patientId"
      ),
      'template', (
        select jsonb_build_object('id', t.id, 'name', t."name", 'category', t.category)
        from public.test_templates t
        where t.id = v_report."templateId"
      ),
      'values', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', rv.id,
            'fieldId', rv."fieldId",
            'value', rv.value,
            'isAbnormal', rv."isAbnormal",
            'field', jsonb_build_object(
              'fieldName', f."fieldName",
              'unit', f.unit,
              'fieldType', f."fieldType",
              'normalRangeText', f."normalRangeText",
              'normalRangeTextMale', f."normalRangeTextMale",
              'normalRangeTextFemale', f."normalRangeTextFemale",
              'normalRangeMin', f."normalRangeMin",
              'normalRangeMax', f."normalRangeMax",
              'section', f.section,
              'sortOrder', f."sortOrder",
              'isBold', f."isBold"
            )
          )
          order by f."sortOrder"
        )
        from public.report_values rv
        join public.template_fields f on f.id = rv."fieldId"
        where rv."reportId" = v_report.id
      ), '[]'::jsonb)
    ),
    'settings', (
      select to_jsonb(s) - 'reportCounter' - 'reportNumberPrefix'
      from public.lab_settings s
      where s.id = 'singleton'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_public_report(text) from public;
grant execute on function public.get_public_report(text) to anon, authenticated, service_role;

-- Only an admin (or the SQL editor / service role) may change a report's link token: stops anyone from setting a
-- guessable one.
create or replace function public.protect_public_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new."publicToken" is distinct from old."publicToken" and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can change a report link.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_public_token on public.reports;
create trigger protect_public_token
before update on public.reports
for each row execute procedure public.protect_public_token();

NOTIFY pgrst, 'reload schema';
