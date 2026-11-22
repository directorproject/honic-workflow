-- Ordinary Diploma: Communication System Technology (CST) — distinct from ETE.
insert into public.courses (code, name, sort_order) values
  ('CST', 'Communication System Technology', 25)
on conflict (code) do update
  set name = excluded.name,
      is_active = true;
