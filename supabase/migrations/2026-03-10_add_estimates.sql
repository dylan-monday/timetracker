-- Project Fee Estimator tables
-- Creates estimates, phases, line items, hard costs, and agency roles

-- Create estimate status enum
create type public.estimate_status as enum ('draft', 'live', 'archived');

-- Agency roles (default rates for common roles)
create table if not exists public.agency_roles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  default_hourly_rate_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive unique constraint on agency role names per owner
create unique index if not exists uq_agency_roles_owner_name_ci
  on public.agency_roles(owner_id, lower(name));

-- Estimates (the container)
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status public.estimate_status not null default 'draft',
  project_id uuid references public.projects(id) on delete set null,
  markup_percent numeric(5,2) not null default 15.00,
  contingency_percent numeric(5,2) not null default 10.00,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Phases within an estimate
create table if not exists public.estimate_phases (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personnel/role line items within phases
create table if not exists public.estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.estimate_phases(id) on delete cascade,
  role_name text not null,
  person_name text,
  person_id uuid references auth.users(id) on delete set null,
  hours numeric(8,2) not null default 0,
  hourly_rate_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hard costs (not subject to markup)
create table if not exists public.estimate_hard_costs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  amount_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_estimates_owner on public.estimates(owner_id);
create index if not exists idx_estimates_project on public.estimates(project_id);
create index if not exists idx_estimates_status on public.estimates(owner_id, status);
create index if not exists idx_estimate_phases_estimate on public.estimate_phases(estimate_id);
create index if not exists idx_estimate_line_items_phase on public.estimate_line_items(phase_id);
create index if not exists idx_estimate_hard_costs_estimate on public.estimate_hard_costs(estimate_id);
create index if not exists idx_agency_roles_owner on public.agency_roles(owner_id);

-- Updated at triggers
create trigger set_agency_roles_updated_at before update on public.agency_roles
for each row execute procedure public.set_updated_at();

create trigger set_estimates_updated_at before update on public.estimates
for each row execute procedure public.set_updated_at();

create trigger set_estimate_phases_updated_at before update on public.estimate_phases
for each row execute procedure public.set_updated_at();

create trigger set_estimate_line_items_updated_at before update on public.estimate_line_items
for each row execute procedure public.set_updated_at();

create trigger set_estimate_hard_costs_updated_at before update on public.estimate_hard_costs
for each row execute procedure public.set_updated_at();

-- Enable RLS
alter table public.agency_roles enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_phases enable row level security;
alter table public.estimate_line_items enable row level security;
alter table public.estimate_hard_costs enable row level security;

-- RLS policies for agency_roles
create policy "owner full access agency roles" on public.agency_roles
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- RLS policies for estimates
create policy "owner full access estimates" on public.estimates
for all using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- RLS policies for estimate_phases (access via estimate ownership)
create policy "owner full access estimate phases" on public.estimate_phases
for all using (
  exists (
    select 1 from public.estimates e
    where e.id = estimate_id and e.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.estimates e
    where e.id = estimate_id and e.owner_id = auth.uid()
  )
);

-- RLS policies for estimate_line_items (access via phase -> estimate ownership)
create policy "owner full access estimate line items" on public.estimate_line_items
for all using (
  exists (
    select 1 from public.estimate_phases p
    join public.estimates e on e.id = p.estimate_id
    where p.id = phase_id and e.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.estimate_phases p
    join public.estimates e on e.id = p.estimate_id
    where p.id = phase_id and e.owner_id = auth.uid()
  )
);

-- RLS policies for estimate_hard_costs (access via estimate ownership)
create policy "owner full access estimate hard costs" on public.estimate_hard_costs
for all using (
  exists (
    select 1 from public.estimates e
    where e.id = estimate_id and e.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.estimates e
    where e.id = estimate_id and e.owner_id = auth.uid()
  )
);

-- Seed default agency roles for existing users
-- (This will be called manually or via the app on first use)
create or replace function public.create_default_agency_roles(p_owner_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.agency_roles (owner_id, name, default_hourly_rate_cents, sort_order)
  select p_owner_id, v.name, v.rate, v.sort_order
  from (
    values
      ('Executive Creative Director', 35000, 1),
      ('Creative Director', 30000, 2),
      ('Associate Creative Director', 25000, 3),
      ('Senior Designer', 20000, 4),
      ('Designer', 17500, 5),
      ('Junior Designer', 15000, 6),
      ('Producer', 20000, 7),
      ('Project Manager', 17500, 8),
      ('Strategist', 25000, 9),
      ('Copywriter', 20000, 10)
  ) as v(name, rate, sort_order)
  where not exists (
    select 1
    from public.agency_roles ar
    where ar.owner_id = p_owner_id
      and lower(ar.name) = lower(v.name)
  );
end;
$$;
