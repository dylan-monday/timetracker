-- Monday + Partners Time Tracker schema
-- PostgreSQL 15+ (Supabase)

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'user');
create type public.client_kind as enum ('external', 'internal');
create type public.entry_status as enum ('draft', 'approved', 'rejected');
create type public.entry_source as enum ('manual', 'calendar');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.app_role not null default 'user',
  timezone text not null default 'America/Los_Angeles',
  hourly_rate_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email) > 1)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
begin
  user_email := coalesce(new.email, '');

  if user_email !~* '@mondayandpartners\.com$' then
    raise exception 'only mondayandpartners.com accounts are allowed';
  end if;

  insert into public.profiles (id, email, role)
  values (
    new.id,
    user_email,
    case when lower(user_email) = 'dylan@mondayandpartners.com' then 'admin'::public.app_role else 'user'::public.app_role end
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind public.client_kind not null default 'external',
  hourly_rate_cents integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  active boolean not null default true,
  budget_cents integer,
  hourly_rate_cents integer,
  merged_into_project_id uuid references public.projects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_merge_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  source_project_id uuid not null references public.projects(id) on delete restrict,
  target_project_id uuid not null references public.projects(id) on delete restrict,
  effective_date date not null,
  created_at timestamptz not null default now(),
  check (source_project_id <> target_project_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  entry_date date not null,
  start_time timestamptz,
  end_time timestamptz,
  rounded_minutes integer not null,
  status public.entry_status not null default 'approved',
  source public.entry_source not null default 'manual',
  tags text[] not null default '{}',
  notes text,
  calendar_event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rounded_minutes >= 0),
  check (rounded_minutes % 15 = 0)
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google',
  provider_user_id text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, provider_user_id)
);

create table if not exists public.calendar_feed_sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  feed_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, feed_url)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  calendar_connection_id uuid references public.calendar_connections(id) on delete set null,
  external_event_id text not null,
  calendar_id text not null,
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guessed_client_id uuid references public.clients(id) on delete set null,
  guessed_project_id uuid references public.projects(id) on delete set null,
  confidence numeric(5,2),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, calendar_id, external_event_id),
  check (ends_at > starts_at)
);

alter table public.time_entries
  add constraint fk_time_entries_calendar_event
  foreign key (calendar_event_id) references public.calendar_events(id) on delete set null;

create table if not exists public.recurring_mappings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  signature text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  auto_approve boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, signature)
);

create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  job_kind text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (owner_id, job_kind, scheduled_for)
);

create index if not exists idx_time_entries_owner_date on public.time_entries(owner_id, entry_date);
create index if not exists idx_time_entries_owner_project_date on public.time_entries(owner_id, project_id, entry_date);
create index if not exists idx_projects_owner_client on public.projects(owner_id, client_id);
create index if not exists idx_calendar_events_owner_start on public.calendar_events(owner_id, starts_at);
create unique index if not exists uq_clients_owner_name_ci on public.clients(owner_id, lower(name));
create unique index if not exists uq_projects_owner_client_name_ci on public.projects(owner_id, client_id, lower(name));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger set_clients_updated_at before update on public.clients
for each row execute procedure public.set_updated_at();

create trigger set_projects_updated_at before update on public.projects
for each row execute procedure public.set_updated_at();

create trigger set_time_entries_updated_at before update on public.time_entries
for each row execute procedure public.set_updated_at();

create trigger set_calendar_connections_updated_at before update on public.calendar_connections
for each row execute procedure public.set_updated_at();

create trigger set_calendar_feed_sources_updated_at before update on public.calendar_feed_sources
for each row execute procedure public.set_updated_at();

create trigger set_calendar_events_updated_at before update on public.calendar_events
for each row execute procedure public.set_updated_at();

create trigger set_recurring_mappings_updated_at before update on public.recurring_mappings
for each row execute procedure public.set_updated_at();

create or replace function public.apply_project_merge(
  p_owner_id uuid,
  p_source_project_id uuid,
  p_target_project_id uuid,
  p_effective_date date
)
returns void
language plpgsql
as $$
begin
  if p_source_project_id = p_target_project_id then
    raise exception 'source and target project must differ';
  end if;

  insert into public.project_merge_events (
    owner_id,
    source_project_id,
    target_project_id,
    effective_date
  )
  values (p_owner_id, p_source_project_id, p_target_project_id, p_effective_date);

  update public.time_entries
  set project_id = p_target_project_id
  where owner_id = p_owner_id
    and project_id = p_source_project_id
    and entry_date >= p_effective_date;

  update public.projects
  set merged_into_project_id = p_target_project_id,
      active = false
  where id = p_source_project_id
    and owner_id = p_owner_id;
end;
$$;

create or replace function public.create_default_internal_clients(p_owner_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.clients (owner_id, name, kind, active)
  select p_owner_id, v.name, 'internal'::public.client_kind, true
  from (
    values
      ('Business Dev'),
      ('Admin'),
      ('Team'),
      ('Learning'),
      ('Recruiting'),
      ('Marketing'),
      ('Exercise')
  ) as v(name)
  where not exists (
    select 1
    from public.clients c
    where c.owner_id = p_owner_id
      and lower(c.name) = lower(v.name)
  );
end;
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_merge_events enable row level security;
alter table public.time_entries enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_feed_sources enable row level security;
alter table public.calendar_events enable row level security;
alter table public.recurring_mappings enable row level security;
alter table public.email_jobs enable row level security;

create policy "profile self read" on public.profiles
for select using (auth.uid() = id);

create policy "profile self update" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "domain sign-in only" on public.profiles
for insert with check (email ilike '%@mondayandpartners.com');

create policy "owner full access clients" on public.clients
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access projects" on public.projects
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access project merges" on public.project_merge_events
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access time entries" on public.time_entries
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access calendar connections" on public.calendar_connections
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access calendar feed sources" on public.calendar_feed_sources
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access calendar events" on public.calendar_events
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access recurring mappings" on public.recurring_mappings
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "owner full access email jobs" on public.email_jobs
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Bootstrap helper for first admin user.
-- Run once after first Google sign in.
-- update public.profiles set role = 'admin' where email = 'dylan@mondayandpartners.com';
-- select public.create_default_internal_clients('<OWNER_UUID>');
