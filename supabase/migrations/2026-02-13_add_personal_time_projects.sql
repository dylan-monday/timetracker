-- Migration: Add Personal time category projects
-- These are first-class internal activities that appear alongside client work

-- Update the create_default_internal_clients function to also create default projects
create or replace function public.create_default_internal_clients(p_owner_id uuid)
returns void
language plpgsql
as $$
declare
  v_personal_client_id uuid;
begin
  -- Create internal clients if they don't exist
  insert into public.clients (owner_id, name, kind, active)
  select p_owner_id, v.name, 'internal'::public.client_kind, true
  from (
    values
      ('M+P'),
      ('Personal')
  ) as v(name)
  where not exists (
    select 1
    from public.clients c
    where c.owner_id = p_owner_id
      and lower(c.name) = lower(v.name)
  );

  -- Get the Personal client ID
  select id into v_personal_client_id
  from public.clients
  where owner_id = p_owner_id
    and lower(name) = 'personal'
  limit 1;

  -- Create default personal projects if Personal client exists
  if v_personal_client_id is not null then
    insert into public.projects (owner_id, client_id, name, active)
    select p_owner_id, v_personal_client_id, v.name, true
    from (
      values
        ('Thinking & Strategy'),
        ('Recharging'),
        ('Exercise'),
        ('Personal Development'),
        ('Reading')
    ) as v(name)
    where not exists (
      select 1
      from public.projects p
      where p.owner_id = p_owner_id
        and p.client_id = v_personal_client_id
        and lower(p.name) = lower(v.name)
    );
  end if;
end;
$$;

-- Add personal projects for all existing users who have a Personal client
do $$
declare
  v_record record;
begin
  for v_record in
    select c.owner_id, c.id as client_id
    from public.clients c
    where lower(c.name) = 'personal'
      and c.kind = 'internal'
      and c.active = true
  loop
    insert into public.projects (owner_id, client_id, name, active)
    select v_record.owner_id, v_record.client_id, v.name, true
    from (
      values
        ('Thinking & Strategy'),
        ('Recharging'),
        ('Exercise'),
        ('Personal Development'),
        ('Reading')
    ) as v(name)
    where not exists (
      select 1
      from public.projects p
      where p.owner_id = v_record.owner_id
        and p.client_id = v_record.client_id
        and lower(p.name) = lower(v.name)
    );
  end loop;
end;
$$;
