-- Migration 18: security hardening
-- Run in the Supabase SQL Editor, AFTER deploying the matching app code (see notes at the bottom).
-- Safe to re-run. Fixes findings S1-S7 and S10 of the security audit:
--   S1  any user could promote themselves to ADMIN / re-activate themselves via the profiles table
--   S2  the new-user trigger trusted the role sent by the client
--   S3  any user (even inactive) could insert/update doctor incentive rows
--   S4  any user (even inactive) could edit/delete test templates and fields
--   S5  anonymous callers could run next_report_number() / next_patient_code()
--   S6  finalised reports could be silently edited; the audit log was never written
--   S7  deactivated admins kept power over doctors/incentives; doctors were readable by inactive users
--
-- Rows written from the SQL editor or with the service-role key (auth.uid() is null) are exempt from the
-- guards below, so admin maintenance and the invite-user edge function keep working.

-- ═════════════════════════════════════════════════════════════════════════════
-- 0. Helper functions: pin search_path (security-definer functions must not use the caller's)
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN' and "isActive" = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and "isActive" = true
  );
$$;

grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.is_active_user() to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- S1 + S2. Profiles: only admins may change role / status / email; sign-ups are always STAFF
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new; -- service role / SQL editor / active admin
  end if;
  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new."isActive" is distinct from old."isActive"
     or new.email is distinct from old.email then
    raise exception 'Only an administrator can change role, status or email.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
before update on public.profiles
for each row execute procedure public.protect_profile_columns();

-- Profiles are created by the trigger below (or by the invite function with the service role), never by clients
drop policy if exists "profiles_insert" on public.profiles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The role in raw_user_meta_data is client-controlled, so it is ignored: everyone starts as STAFF.
  -- The invite-user edge function (service role) sets ADMIN afterwards when an admin asks for it.
  insert into public.profiles (id, "name", email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'STAFF'
  )
  on conflict (id) do update
    set "name" = excluded."name",
        email = excluded.email;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 01.sql granted every logged-in user read access to auth.users; nothing needs it
do $$
begin
  revoke select on auth.users from authenticated;
exception when others then
  raise notice 'Could not revoke select on auth.users (%). Revoke it manually if it is still granted.', sqlerrm;
end
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- S4. Test templates and fields: admin-only writes (undo the open policies from 11.sql)
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists "templates_update_authenticated" on public.test_templates;
drop policy if exists "fields_update_authenticated" on public.template_fields;
drop policy if exists "fields_insert_authenticated" on public.template_fields;
drop policy if exists "fields_delete_authenticated" on public.template_fields;

drop policy if exists "templates_insert" on public.test_templates;
create policy "templates_insert" on public.test_templates for insert with check (public.is_admin());
drop policy if exists "templates_update" on public.test_templates;
create policy "templates_update" on public.test_templates for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "templates_delete" on public.test_templates;
create policy "templates_delete" on public.test_templates for delete using (public.is_admin());

drop policy if exists "fields_insert" on public.template_fields;
create policy "fields_insert" on public.template_fields for insert with check (public.is_admin());
drop policy if exists "fields_update" on public.template_fields;
create policy "fields_update" on public.template_fields for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "fields_delete" on public.template_fields;
create policy "fields_delete" on public.template_fields for delete using (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- S3 + S7. Doctors and incentives
-- ═════════════════════════════════════════════════════════════════════════════
drop policy if exists "Authenticated users can read doctors" on public.doctors;
drop policy if exists "Admins can manage doctors" on public.doctors;
drop policy if exists "doctors_select" on public.doctors;
drop policy if exists "doctors_admin_write" on public.doctors;
create policy "doctors_select" on public.doctors for select to authenticated using (public.is_active_user());
create policy "doctors_admin_write" on public.doctors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Staff create / re-sync incentive rows when finalising or taking payment (app code), so inserts and updates stay
-- open to active users, but only for a row that matches the report's real doctor, that doctor's current rate and
-- a bill no larger than the report's gross bill, and never as "paid".
create or replace function public.incentive_matches_report(p_report uuid, p_doctor uuid, p_rate numeric, p_bill numeric)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reports r
    join public.patients p on p.id = r."patientId"
    join public.doctors d on d.id = p."doctorId"
    left join public.test_templates t on t.id = r."templateId"
    where r.id = p_report
      and d.id = p_doctor
      and d."incentiveRate" = p_rate
      and p_bill >= 0
      and p_bill <= coalesce(r."billAmount", t.price, 0) + 0.01
  );
$$;

grant execute on function public.incentive_matches_report(uuid, uuid, numeric, numeric) to authenticated;

drop policy if exists "Admins full access to incentives" on public.report_incentives;
drop policy if exists "Admins can manage incentives" on public.report_incentives;
drop policy if exists "Staff can insert incentives" on public.report_incentives;
drop policy if exists "Staff can update incentives" on public.report_incentives;
drop policy if exists "Authenticated can read incentives" on public.report_incentives;
drop policy if exists "incentives_admin_all" on public.report_incentives;
drop policy if exists "incentives_select" on public.report_incentives;
drop policy if exists "incentives_staff_insert" on public.report_incentives;
drop policy if exists "incentives_staff_update" on public.report_incentives;

create policy "incentives_admin_all" on public.report_incentives for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "incentives_select" on public.report_incentives for select to authenticated
  using (public.is_active_user());

create policy "incentives_staff_insert" on public.report_incentives for insert to authenticated
  with check (
    public.is_active_user()
    and ispaid = false and paidat is null
    and public.incentive_matches_report("reportId", "doctorId", "incentiveRate", billamount)
  );

create policy "incentives_staff_update" on public.report_incentives for update to authenticated
  using (public.is_active_user() and ispaid = false)
  with check (
    public.is_active_user()
    and ispaid = false and paidat is null
    and public.incentive_matches_report("reportId", "doctorId", "incentiveRate", billamount)
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- S5. Numbering functions: signed-in active users only
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.next_report_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_counter integer;
  prefix text;
begin
  if not public.is_active_user() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  insert into public.lab_settings (id) values ('singleton') on conflict (id) do nothing;

  update public.lab_settings
  set "reportCounter" = "reportCounter" + 1
  where id = 'singleton'
  returning "reportCounter", "reportNumberPrefix"
  into next_counter, prefix;

  return prefix || extract(year from current_date)::text || '-' || lpad(next_counter::text, 5, '0');
end;
$$;

create or replace function public.next_patient_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if not public.is_active_user() then
    raise exception 'Not authorised.' using errcode = '42501';
  end if;

  lock table public.patients in exclusive mode;

  select coalesce(max(nullif(regexp_replace("patientCode", '[^0-9]', '', 'g'), '')::integer), 0) + 1
  into next_number
  from public.patients;

  return 'PAT-' || lpad(next_number::text, 5, '0');
end;
$$;

revoke execute on function public.next_report_number() from public, anon;
revoke execute on function public.next_patient_code() from public, anon;
grant execute on function public.next_report_number() to authenticated, service_role;
grant execute on function public.next_patient_code() to authenticated, service_role;

-- ═════════════════════════════════════════════════════════════════════════════
-- S6. Finalised reports are locked for non-admins; every change is recorded in audit_logs
-- ═════════════════════════════════════════════════════════════════════════════

-- 6a. A FINAL / SENT report keeps its patient, test, number, collection time and clinical notes.
--     (Payment fields and the FINAL -> SENT status change stay open for staff.)
create or replace function public.guard_final_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if old.status in ('FINAL', 'SENT') then
    if new."patientId" is distinct from old."patientId"
       or new."templateId" is distinct from old."templateId"
       or new."reportNumber" is distinct from old."reportNumber"
       or new."createdById" is distinct from old."createdById"
       or new."collectedAt" is distinct from old."collectedAt"
       or new.notes is distinct from old.notes
       or new.status = 'DRAFT' then
      raise exception 'This report is finalised and locked. Ask an administrator to amend it.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_final_reports on public.reports;
create trigger guard_final_reports
before update on public.reports
for each row execute procedure public.guard_final_reports();

-- 6b. Result values of a finalised report cannot be changed or removed by non-admins
create or replace function public.guard_final_report_values()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.report_status_type;
begin
  if auth.uid() is null or public.is_admin() then
    return coalesce(new, old);
  end if;
  select status into v_status from public.reports where id = old."reportId";
  if v_status in ('FINAL', 'SENT') then
    raise exception 'This report is finalised and locked. Ask an administrator to amend it.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists guard_final_report_values on public.report_values;
create trigger guard_final_report_values
before update or delete on public.report_values
for each row execute procedure public.guard_final_report_values();

-- 6c. Staff may delete their own mistakes while a report is still a draft (the app offers this; 01.sql
--     only allowed admins, so the delete silently did nothing). Values go with it via ON DELETE CASCADE.
drop policy if exists "reports_delete_draft" on public.reports;
create policy "reports_delete_draft" on public.reports for delete
  using (public.is_active_user() and status = 'DRAFT');

-- 6d. Audit trail. Clients can no longer write to audit_logs; these triggers do.
drop policy if exists "audit_logs_insert" on public.audit_logs;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_old jsonb;
  v_new jsonb;
  v_meta jsonb;
  v_status public.report_status_type;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user) then
    return coalesce(new, old);
  end if;

  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new := case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) end;

  -- Editing a draft rewrites its values every time; only log values of finalised reports
  if tg_table_name = 'report_values' then
    select status into v_status
    from public.reports
    where id = coalesce(v_new ->> 'reportId', v_old ->> 'reportId')::uuid;
    if v_status is null or v_status = 'DRAFT' then
      return coalesce(new, old);
    end if;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
    into v_meta
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key)
      and n.key <> 'updatedAt'
      and not (tg_table_name = 'lab_settings' and n.key = 'reportCounter'); -- bumped on every new report
    if v_meta is null then
      return new; -- nothing but updatedAt changed
    end if;
  else
    v_meta := jsonb_build_object('old', v_old);
  end if;

  insert into public.audit_logs ("userId", action, "entityType", "entityId", meta)
  values (v_user, tg_op, tg_table_name, coalesce(v_new ->> 'id', v_old ->> 'id'), v_meta);

  return coalesce(new, old);
end;
$$;

revoke execute on function public.write_audit_log() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'reports', 'report_values', 'patients', 'test_templates', 'template_fields',
    'report_incentives', 'doctors', 'lab_settings', 'profiles'
  ] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after update or delete on public.%1$I for each row execute procedure public.write_audit_log()',
      t
    );
  end loop;
end
$$;

create index if not exists audit_logs_entity_idx on public.audit_logs ("entityType", "entityId");
create index if not exists audit_logs_created_idx on public.audit_logs ("createdAt" desc);

NOTIFY pgrst, 'reload schema';

-- ═════════════════════════════════════════════════════════════════════════════
-- Checks to run afterwards (SQL editor)
-- ═════════════════════════════════════════════════════════════════════════════
--  1. Who are the admins? Remove anyone who should not be one (an earlier self-promotion would show here):
--       select email, role, "isActive", "createdAt" from public.profiles where role = 'ADMIN' order by "createdAt";
--  2. Policies in force on the sensitive tables:
--       select tablename, policyname, cmd, roles from pg_policies
--       where tablename in ('profiles','report_incentives','test_templates','template_fields','doctors','audit_logs')
--       order by tablename, cmd;
--  3. Dashboard: Authentication -> Providers -> Email -> turn OFF "Allow new users to sign up"
--     (this app only uses invitations).
