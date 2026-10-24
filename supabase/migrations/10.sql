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

  return prefix || extract(year from current_date)::text || '-' || lpad(next_counter::text, 5, '0');
end;
$$;
