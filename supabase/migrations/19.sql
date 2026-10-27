-- Migration 19: accounts created outside the invite flow start INACTIVE
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- Why: if "Allow new users to sign up" is ever left on (it was, on this project), anyone holding the public
-- anon key could register and would get an ACTIVE staff profile, i.e. read access to every patient and report.
-- After this migration a self-registered account has no access until an admin activates it.
--
-- The invite-user edge function is unaffected: it creates the account, then (using the service role) sets
-- the profile to the requested role with "isActive" = true.
--
-- Accounts created by hand in the Supabase dashboard also start inactive now. To let one in, an admin can
-- switch the person on in Staff & Users, or run:
--   update public.profiles set "isActive" = true where email = 'person@example.com';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, "name", email, role, "isActive")
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'STAFF',
    false
  )
  on conflict (id) do update
    set "name" = excluded."name",
        email = excluded.email;  -- never touches role or isActive of an existing profile
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Review who has an account (run manually). Anyone you do not recognise should be deleted
-- in Authentication > Users (this also removes their profile):
--
--   select u.email, u.created_at, u.last_sign_in_at, p.role, p."isActive"
--   from auth.users u
--   left join public.profiles p on p.id = u.id
--   order by u.created_at desc;
-- ─────────────────────────────────────────────────────────────────────────────
