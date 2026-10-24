-- LabFlow React + Supabase setup
-- Run this file in the Supabase SQL editor.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type public.role_type as enum ('ADMIN', 'STAFF');
  end if;
  if not exists (select 1 from pg_type where typname = 'gender_type') then
    create type public.gender_type as enum ('MALE', 'FEMALE', 'OTHER');
  end if;
  if not exists (select 1 from pg_type where typname = 'field_type') then
    create type public.field_type as enum ('NUMBER', 'TEXT', 'SELECT');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_status_type') then
    create type public.report_status_type as enum ('DRAFT', 'FINAL', 'SENT');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  "name" text not null,
  email text not null unique,
  role public.role_type not null default 'STAFF',
  "isActive" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  "patientCode" text not null unique,
  "name" text not null,
  age integer not null,
  gender public.gender_type not null,
  phone text not null,
  email text,
  address text,
  "refDoctor" text,
  "bloodGroup" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.test_templates (
  id uuid primary key default gen_random_uuid(),
  "name" text not null,
  category text not null,
  description text,
  price numeric(10, 2),
  "isActive" boolean not null default true,
  "createdById" uuid not null references public.profiles(id) on delete restrict,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.template_fields (
  id uuid primary key default gen_random_uuid(),
  "templateId" uuid not null references public.test_templates(id) on delete cascade,
  "fieldName" text not null,
  unit text,
  "normalRangeText" text,
  "normalRangeMin" double precision,
  "normalRangeMax" double precision,
  "fieldType" public.field_type not null default 'NUMBER',
  section text,
  "sortOrder" integer not null default 0,
  "isBold" boolean not null default false
);

create table if not exists public.lab_settings (
  id text primary key default 'singleton',
  "labName" text not null default 'My Pathology Lab',
  "labAddress" text not null default '',
  "labPhone" text not null default '',
  "labEmail" text not null default '',
  "labWebsite" text,
  "logoUrl" text,
  "signatureUrl" text,
  "pathologistName" text not null default '',
  "pathologistQual" text not null default '',
  "reportNumberPrefix" text not null default 'LAB-',
  "reportCounter" integer not null default 0,
  "reportFooter" text,
  "accentColor" text not null default '#0f766e'
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  "reportNumber" text not null unique,
  "patientId" uuid not null references public.patients(id) on delete cascade,
  "templateId" uuid not null references public.test_templates(id) on delete restrict,
  "createdById" uuid not null references public.profiles(id) on delete restrict,
  status public.report_status_type not null default 'DRAFT',
  "collectedAt" timestamptz not null default now(),
  "reportedAt" timestamptz,
  notes text,
  "pdfUrl" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.report_values (
  id uuid primary key default gen_random_uuid(),
  "reportId" uuid not null references public.reports(id) on delete cascade,
  "fieldId" uuid not null references public.template_fields(id) on delete restrict,
  value text not null,
  "isAbnormal" boolean not null default false,
  unique ("reportId", "fieldId")
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  "entityType" text not null,
  "entityId" text not null,
  meta jsonb,
  "createdAt" timestamptz not null default now()
);

insert into public.lab_settings (id)
values ('singleton')
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at before update on public.patients for each row execute procedure public.set_updated_at();

drop trigger if exists set_templates_updated_at on public.test_templates;
create trigger set_templates_updated_at before update on public.test_templates for each row execute procedure public.set_updated_at();

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at before update on public.reports for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, "name", email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.role_type, 'STAFF')
  )
  on conflict (id) do update
    set "name" = excluded."name",
        email = excluded.email;

  return new;
end;
$$;

-- Grant necessary permissions
grant usage on schema public to postgres, authenticated, service_role;
grant all privileges on public.profiles to postgres, service_role;
grant select, insert, update on public.profiles to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and "isActive" = true
  );
$$;

grant execute on function public.is_admin() to authenticated;

grant execute on function public.is_admin() to service_role;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and "isActive" = true
  );
$$;

grant execute on function public.is_active_user() to authenticated;

grant execute on function public.is_active_user() to service_role;

create or replace function public.next_patient_code()
returns text
language plpgsql
security definer
as $$
declare
  next_number integer;
begin
  lock table public.patients in exclusive mode;

  select coalesce(max(nullif(regexp_replace("patientCode", '[^0-9]', '', 'g'), '')::integer), 0) + 1
  into next_number
  from public.patients;

  return 'PAT-' || lpad(next_number::text, 5, '0');
end;
$$;

create or replace function public.next_report_number()
returns text
language plpgsql
security definer
as $$
declare
  next_counter integer;
  prefix text;
begin
  insert into public.lab_settings (id)
  values ('singleton')
  on conflict (id) do nothing;

  update public.lab_settings
  set "reportCounter" = "reportCounter" + 1
  where id = 'singleton'
  returning "reportCounter", "reportNumberPrefix"
  into next_counter, prefix;

  return prefix || extract(year from current_date)::text || '-' || lpad(next_counter::text, 4, '0');
end;
$$;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.test_templates enable row level security;
alter table public.template_fields enable row level security;
alter table public.lab_settings enable row level security;
alter table public.reports enable row level security;
alter table public.report_values enable row level security;
alter table public.audit_logs enable row level security;

-- Grant permissions to the handle_new_user function to read auth.users
grant select on auth.users to authenticated;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "patients_select" on public.patients;
create policy "patients_select" on public.patients
for select using (public.is_active_user());

drop policy if exists "patients_insert" on public.patients;
create policy "patients_insert" on public.patients
for insert with check (public.is_active_user());

drop policy if exists "patients_update" on public.patients;
create policy "patients_update" on public.patients
for update using (public.is_active_user())
with check (public.is_active_user());

drop policy if exists "patients_delete" on public.patients;
create policy "patients_delete" on public.patients
for delete using (public.is_admin());

drop policy if exists "templates_select" on public.test_templates;
create policy "templates_select" on public.test_templates
for select using (public.is_active_user());

drop policy if exists "templates_insert" on public.test_templates;
create policy "templates_insert" on public.test_templates
for insert with check (public.is_admin());

drop policy if exists "templates_update" on public.test_templates;
create policy "templates_update" on public.test_templates
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "templates_delete" on public.test_templates;
create policy "templates_delete" on public.test_templates
for delete using (public.is_admin());

drop policy if exists "fields_select" on public.template_fields;
create policy "fields_select" on public.template_fields
for select using (public.is_active_user());

drop policy if exists "fields_insert" on public.template_fields;
create policy "fields_insert" on public.template_fields
for insert with check (public.is_admin());

drop policy if exists "fields_update" on public.template_fields;
create policy "fields_update" on public.template_fields
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "fields_delete" on public.template_fields;
create policy "fields_delete" on public.template_fields
for delete using (public.is_admin());

drop policy if exists "settings_select" on public.lab_settings;
create policy "settings_select" on public.lab_settings
for select using (public.is_active_user());

drop policy if exists "settings_write" on public.lab_settings;
create policy "settings_write" on public.lab_settings
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
for select using (public.is_active_user());

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
for insert with check (public.is_active_user());

drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports
for update using (public.is_active_user())
with check (public.is_active_user());

drop policy if exists "reports_delete" on public.reports;
create policy "reports_delete" on public.reports
for delete using (public.is_admin());

drop policy if exists "report_values_select" on public.report_values;
create policy "report_values_select" on public.report_values
for select using (public.is_active_user());

drop policy if exists "report_values_insert" on public.report_values;
create policy "report_values_insert" on public.report_values
for insert with check (public.is_active_user());

drop policy if exists "report_values_update" on public.report_values;
create policy "report_values_update" on public.report_values
for update using (public.is_active_user())
with check (public.is_active_user());

drop policy if exists "report_values_delete" on public.report_values;
create policy "report_values_delete" on public.report_values
for delete using (public.is_admin());

drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select" on public.audit_logs
for select using (public.is_admin());

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs
for insert with check (public.is_active_user());

insert into storage.buckets (id, name, public)
values ('lab-assets', 'lab-assets', true)
on conflict (id) do nothing;

drop policy if exists "lab_assets_read" on storage.objects;
create policy "lab_assets_read" on storage.objects
for select using (bucket_id = 'lab-assets');

drop policy if exists "lab_assets_write" on storage.objects;
create policy "lab_assets_write" on storage.objects
for all using (bucket_id = 'lab-assets' and public.is_admin())
with check (bucket_id = 'lab-assets' and public.is_admin());

create index if not exists patients_patient_code_idx on public.patients ("patientCode");
create index if not exists patients_name_idx on public.patients ("name");
create index if not exists reports_patient_id_idx on public.reports ("patientId");
create index if not exists reports_template_id_idx on public.reports ("templateId");
create index if not exists reports_created_at_idx on public.reports ("createdAt" desc);
create index if not exists report_values_report_id_idx on public.report_values ("reportId");
